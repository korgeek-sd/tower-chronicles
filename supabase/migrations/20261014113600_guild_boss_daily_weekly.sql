-- Guild bosses: fixed-difficulty daily/weekly asynchronous raids with shared health.
-- Schedules: daily 00:00 KST, weekly Saturday 00:00 KST.
create table if not exists private.guild_boss_encounters(
  encounter_id uuid primary key default gen_random_uuid(),
  association_id uuid not null references private.online_associations(association_id) on delete cascade,
  kind text not null check(kind in ('DAILY','WEEKLY')),
  cycle_start timestamptz not null,
  cycle_end timestamptz not null,
  boss_name text not null,
  max_hp bigint not null check(max_hp>0),
  remaining_hp bigint not null check(remaining_hp>=0 and remaining_hp<=max_hp),
  attack_power numeric not null check(attack_power>=0),
  defense_power numeric not null check(defense_power>=0),
  total_attacks bigint not null default 0,
  defeated_at timestamptz,
  created_at timestamptz not null default now(),
  unique(association_id,kind,cycle_start),
  check(cycle_end>cycle_start)
);
create index if not exists guild_boss_encounters_lookup on private.guild_boss_encounters(association_id,kind,cycle_start desc);
alter table private.guild_boss_encounters enable row level security;
revoke all on private.guild_boss_encounters from public,anon,authenticated;

create table if not exists private.guild_boss_attacks(
  attack_id bigint generated always as identity primary key,
  encounter_id uuid not null references private.guild_boss_encounters(encounter_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  day_kst date not null,
  damage bigint not null check(damage>=0),
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id,request_id)
);
create index if not exists guild_boss_attacks_daily on private.guild_boss_attacks(encounter_id,user_id,day_kst);
create index if not exists guild_boss_attacks_leaders on private.guild_boss_attacks(encounter_id,user_id);
alter table private.guild_boss_attacks enable row level security;
revoke all on private.guild_boss_attacks from public,anon,authenticated;

create or replace function private.guild_boss_cycle_start(p_kind text,p_at timestamptz default now())
returns timestamptz language plpgsql stable set search_path='' as $$
declare kst_day date:=(p_at at time zone 'Asia/Seoul')::date;
begin
 if p_kind='DAILY' then return kst_day::timestamp at time zone 'Asia/Seoul';end if;
 if p_kind='WEEKLY' then
  return (kst_day-((extract(dow from kst_day)::integer+1)%7))::timestamp at time zone 'Asia/Seoul';
 end if;
 raise exception 'GUILD_BOSS_KIND_INVALID';
end;$$;

create or replace function private.guild_boss_ensure(p_association uuid,p_kind text,p_at timestamptz default now())
returns private.guild_boss_encounters language plpgsql security definer set search_path='' as $$
declare start_at timestamptz; until_at timestamptz; entry private.guild_boss_encounters%rowtype;
begin
 start_at:=private.guild_boss_cycle_start(p_kind,p_at);
 until_at:=((start_at at time zone 'Asia/Seoul')+
   case when p_kind='DAILY' then interval '1 day' else interval '7 days' end) at time zone 'Asia/Seoul';
 insert into private.guild_boss_encounters(association_id,kind,cycle_start,cycle_end,boss_name,max_hp,remaining_hp,attack_power,defense_power)
 values(p_association,p_kind,start_at,until_at,
   case p_kind when 'DAILY' then '황혼의 무리왕' else '심연의 파수자' end,
   case p_kind when 'DAILY' then 2400 else 24000 end,
   case p_kind when 'DAILY' then 2400 else 24000 end,
   case p_kind when 'DAILY' then 13 else 27 end,
   case p_kind when 'DAILY' then 8 else 18 end)
 on conflict(association_id,kind,cycle_start) do nothing;
 select * into strict entry from private.guild_boss_encounters
 where association_id=p_association and kind=p_kind and cycle_start=start_at;
 return entry;
end;$$;

-- Isolated combat: same server-owned equipment, learned catalog skills, enhancements, MP and damage formula as hunting.
-- No vitality/potion consumption and no modification to normal hunting HP/MP.
create or replace function private.guild_boss_combat(p_user uuid,p_boss private.guild_boss_encounters,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero jsonb; hs private.hunting_states%rowtype;
 preset text[]:=array[]::text[]; skill text; candidate text; spec jsonb; family text; weapon text;
 max_hp numeric; hp numeric; attack numeric; defense numeric; crit numeric; crit_multiplier numeric; penetration numeric;
 mp_max numeric; mp numeric; bonus numeric:=0; preparatory numeric:=0; shield numeric:=0; dots numeric:=0;
 passive_hp numeric:=0; hit numeric; dealt bigint:=0; damage_taken numeric; threshold numeric;
 skill_power numeric; skill_chance numeric; skill_mp numeric; enhancement integer; cooldown jsonb:='{}';
 turn_number integer; turns jsonb:='[]'; lines jsonb; label text; guard boolean; active_count integer:=0;
 begin_hp numeric; action_limit integer:=12;
begin
 select * into hs from private.hunting_states where user_id=p_user;
 preset:=coalesce(hs.skills,array[]::text[]);
 hero:=private.combat_equipment_stats(p_user,jsonb_set(p_payload,'{expedition}',jsonb_build_object('equipment',p_payload->'equipped'),true));
 weapon:=coalesce(hero->>'weapon','sword');
 max_hp:=greatest(1,(hero->>'hp')::numeric);hp:=max_hp;begin_hp:=max_hp;
 attack:=greatest(0,(hero->>'attack')::numeric);
 defense:=greatest(0,(hero->>'defense')::numeric);
 crit:=greatest(0,least(1,coalesce((hero->>'critChance')::numeric,.05)));
 crit_multiplier:=greatest(1,coalesce((hero->>'critDamage')::numeric,1.5));
 penetration:=greatest(0,least(1,coalesce((hero->>'armorPenetration')::numeric,0)));
 mp_max:=100+10*coalesce((hs.stat_allocation->>'mp')::integer,0);mp:=mp_max;
 -- Validate every passive server-side and apply the player's enhancement level.
 foreach candidate in array preset loop
  spec:=private.hunting_skill_spec(candidate);
  if spec is null or spec->>'type'<>'passive' or spec->>'weapon' not in ('any',weapon) then continue;end if;
  select enhancement_level into enhancement from private.learned_catalog_skills where user_id=p_user and skill_id=candidate;
  if not found then continue;end if;
  bonus:=(spec->>'power')::numeric*(1+coalesce(enhancement,0)*.05)/100;
  if spec->>'family'='return_oath' then
   max_hp:=max_hp*(1+bonus);hp:=max_hp;begin_hp:=max_hp;
  elsif spec->>'family' in ('sword_mastery','bow_mastery','staff_mastery') then
   passive_hp:=passive_hp+bonus;
  end if;
 end loop;
 for turn_number in 1..action_limit loop
  exit when hp<=0 or dealt>=p_boss.remaining_hp;
  lines:='[]';skill:=null;spec:=null;guard:=false;hit:=0;label:='기본 공격';
  if dots>0 then
   hit:=least(dots,p_boss.remaining_hp-dealt);
   dealt:=dealt+hit::bigint;
   lines:=lines||jsonb_build_array('지속 피해 '||hit::bigint::text);
   dots:=0;
  end if;
  exit when dealt>=p_boss.remaining_hp;
  foreach candidate in array preset loop
   if coalesce((cooldown->>candidate)::integer,0)>turn_number then continue;end if;
   if candidate in ('heavy','quick','guard') then
    if candidate<>'guard' or hp/max_hp<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon) then continue;end if;
   if not exists(select 1 from private.learned_catalog_skills where user_id=p_user and skill_id=candidate) then continue;end if;
   if (spec->>'mp')::numeric>mp then continue;end if;
   if (spec->>'family'='restore' and mp>=mp_max)
    or (spec->>'family'='heal' and hp>=max_hp*.95)
    or (spec->>'family'='shield' and shield>max_hp*.1)
    or (spec->>'family'='prepare' and preparatory>0) then continue;end if;
   skill:=candidate;exit;
  end loop;
  if skill is not null then
   if skill='guard' then
    guard:=true;label:='방어';cooldown:=cooldown||jsonb_build_object(skill,turn_number+4);
   elsif skill in ('heavy','quick') then
    label:=case skill when 'heavy' then '강타' else '속공' end;
    hit:=private.hunting_damage(attack,p_boss.defense_power,
     (case skill when 'heavy' then 1.8 else 1.2 end)*(1+passive_hp)*(case when random()<crit then crit_multiplier else 1 end),
     penetration);
    cooldown:=cooldown||jsonb_build_object(skill,turn_number+case when skill='heavy' then 3 else 2 end);
   else
    select enhancement_level into enhancement from private.learned_catalog_skills where user_id=p_user and skill_id=skill;
    family:=spec->>'family';skill_power:=(spec->>'power')::numeric*(1+coalesce(enhancement,0)*.05);
    skill_chance:=coalesce((spec->>'chance')::numeric,100);skill_mp:=(spec->>'mp')::numeric;
    mp:=mp-skill_mp;active_count:=active_count+1;
    cooldown:=cooldown||jsonb_build_object(skill,turn_number+
      case when family in ('heal','shield') then 4 when family in ('restore','prepare') then 3 else 1 end);
    label:=coalesce((select name from private.skill_book_catalog where skill_id=skill),'스킬');
    if random()*100>=skill_chance then lines:=lines||jsonb_build_array(label||' · 발동 실패');
    elsif family='heal' then
     hit:=0;hp:=least(max_hp,hp+floor(max_hp*skill_power/100));
     lines:=lines||jsonb_build_array(label||' · HP 회복');
    elsif family='restore' then
     mp:=least(mp_max,mp+skill_power);
     lines:=lines||jsonb_build_array(label||' · MP 회복');
    elsif family='shield' then
     shield:=floor(max_hp*skill_power/100);
     lines:=lines||jsonb_build_array(label||' · 보호막');
    elsif family='prepare' then
     preparatory:=skill_power/100;
     lines:=lines||jsonb_build_array(label||' · 위력 증가 준비');
    else
     hit:=private.hunting_damage(attack,p_boss.defense_power,
      skill_power/100*(1+passive_hp)*(1+preparatory)*(case when random()<crit then crit_multiplier else 1 end),
      least(1,penetration+case when family in ('sword_strike','bow_shot') then .05*greatest(0,(spec->>'gradeIndex')::integer-1) else 0 end));
     if family in ('sword_wound','bow_volley','staff_flame') then
      dots:=floor(attack*.1*(1+coalesce(enhancement,0)*.05));
     end if;
     if family='sword_wound' then hp:=least(max_hp,hp+floor(hit*.05));end if;
     if family='staff_rift' then hit:=hit+floor(hit*.05);end if;
     preparatory:=0;
    end if;
   end if;
  else
   hit:=private.hunting_damage(attack,p_boss.defense_power,
    (1+passive_hp)*(1+preparatory)*(case when random()<crit then crit_multiplier else 1 end),penetration);
   preparatory:=0;
  end if;
  if hit>0 then
   hit:=least(hit,p_boss.remaining_hp-dealt);
   dealt:=dealt+hit::bigint;
   lines:=lines||jsonb_build_array(label||' · '||hit::bigint::text||' 피해');
  elsif jsonb_array_length(lines)=0 then lines:=lines||jsonb_build_array(label);
  end if;
  if dealt<p_boss.remaining_hp then
   threshold:=case when p_boss.kind='WEEKLY' and turn_number%4=0 then 1.35 else 1 end;
   damage_taken:=private.hunting_damage(p_boss.attack_power,defense,threshold*(case when guard then .5 else 1 end),0);
   if shield>0 then
    damage_taken:=greatest(0,damage_taken-shield);
    shield:=greatest(0,shield-private.hunting_damage(p_boss.attack_power,defense,threshold,0));
   end if;
   hp:=greatest(0,hp-damage_taken);
   lines:=lines||jsonb_build_array(p_boss.boss_name||'의 반격 · '||damage_taken::bigint::text||' 피해');
  end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_number,'lines',lines,'playerHp',hp,'playerMp',mp,'damageTotal',dealt));
 end loop;
 return jsonb_build_object('damage',dealt,'turns',turns,'playerHp',hp,'maxPlayerHp',begin_hp,'playerMp',mp,'maxPlayerMp',mp_max,
  'outcome',case when hp<=0 then 'defeated' else 'survived' end,'attackStat',attack,'defenseStat',defense,'weapon',weapon);
end;$$;

create or replace function private.guild_boss_state_json(p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid; k text; entry private.guild_boss_encounters%rowtype; result jsonb:='[]'::jsonb;
 used_count integer; contributors integer; mine bigint; ranking jsonb; active_day date:=(now() at time zone 'Asia/Seoul')::date;
 reset_at timestamptz:=((now() at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul';
begin
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=p_user;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 foreach k in array array['DAILY','WEEKLY'] loop
  entry:=private.guild_boss_ensure(aid,k,now());
  select count(*) into used_count from private.guild_boss_attacks
   where encounter_id=entry.encounter_id and user_id=p_user and day_kst=active_day;
  select count(distinct user_id) into contributors from private.guild_boss_attacks where encounter_id=entry.encounter_id;
  select coalesce(sum(damage),0) into mine from private.guild_boss_attacks where encounter_id=entry.encounter_id and user_id=p_user;
  select coalesce(jsonb_agg(jsonb_build_object('userId',q.user_id,'name',q.nickname,'damage',q.damage,'attacks',q.attempts) order by q.damage desc,q.user_id),'[]'::jsonb)
    into ranking
   from (select t.user_id,coalesce(nullif(max(prof.nickname),''),'탐사자') as nickname,sum(t.damage) damage,count(*) attempts
     from private.guild_boss_attacks t
     left join public.game_player_profiles prof on prof.user_id=t.user_id
     where t.encounter_id=entry.encounter_id group by t.user_id order by sum(t.damage) desc,t.user_id limit 10) q;
  result:=result||jsonb_build_array(jsonb_build_object(
   'encounterId',entry.encounter_id,'kind',k,'name',entry.boss_name,'maxHp',entry.max_hp,'remainingHp',entry.remaining_hp,
   'bossAttack',entry.attack_power,'bossDefense',entry.defense_power,'cycleStart',entry.cycle_start,'cycleEnd',entry.cycle_end,
   'defeatedAt',entry.defeated_at,'attacksUsed',used_count,'attacksLeft',greatest(0,5-used_count),
   'myDamage',mine,'participants',contributors,'totalAttacks',entry.total_attacks,'leaderboard',ranking,'nextAttackResetAt',reset_at));
 end loop;
 return jsonb_build_object('associationId',aid,'serverNow',floor(extract(epoch from now())*1000),'bosses',result);
end;$$;

create or replace function public.get_guild_boss_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.guild_boss_state_json(u);
end;$$;

create or replace function public.attack_guild_boss(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;aid uuid;s public.game_saves%rowtype;entry private.guild_boss_encounters%rowtype;
 previous private.guild_boss_attacks%rowtype;used_count integer;day_kst date;combat jsonb;dealt bigint;outcome jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'GUILD_BOSS_REQUEST_REQUIRED';end if;
 if p_kind not in ('DAILY','WEEKLY') or p_kind is null then raise exception 'GUILD_BOSS_KIND_INVALID';end if;
 -- Save lock precedes guild lock, matching other economy operations and protecting equipment snapshots.
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=u;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into previous from private.guild_boss_attacks where user_id=u and request_id=p_request_id;
 if found then
  if not exists(select 1 from private.guild_boss_encounters e where e.encounter_id=previous.encounter_id and e.association_id=aid and e.kind=p_kind)
  then raise exception 'GUILD_BOSS_REQUEST_CONFLICT';end if;
  return jsonb_build_object('result',previous.result,'state',private.guild_boss_state_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
  or coalesce(s.payload->>'expedition','null')<>'null' then raise exception 'GUILD_BOSS_EXPEDITION_ACTIVE';end if;
 entry:=private.guild_boss_ensure(aid,p_kind,now());
 select * into entry from private.guild_boss_encounters where encounter_id=entry.encounter_id for update;
 if entry.defeated_at is not null or entry.remaining_hp<=0 then raise exception 'GUILD_BOSS_DEFEATED';end if;
 if now()>=entry.cycle_end then raise exception 'GUILD_BOSS_EXPIRED';end if;
 day_kst:=(now() at time zone 'Asia/Seoul')::date;
 select count(*) into used_count from private.guild_boss_attacks
 where encounter_id=entry.encounter_id and user_id=u and day_kst=day_kst;
 if used_count>=5 then raise exception 'GUILD_BOSS_ATTACK_LIMIT';end if;
 combat:=private.guild_boss_combat(u,entry,s.payload);
 dealt:=greatest(0,least(entry.remaining_hp,coalesce((combat->>'damage')::bigint,0)));
 update private.guild_boss_encounters
  set remaining_hp=remaining_hp-dealt,total_attacks=total_attacks+1,
   defeated_at=case when remaining_hp-dealt=0 then now() else null end
  where encounter_id=entry.encounter_id;
 outcome:=jsonb_build_object('encounterId',entry.encounter_id,'kind',p_kind,'name',entry.boss_name,
    'damage',dealt,'remainingHp',entry.remaining_hp-dealt,'maxHp',entry.max_hp,
    'defeated',entry.remaining_hp-dealt=0,'attacksLeft',4-used_count,'combat',combat,'createdAt',now());
 insert into private.guild_boss_attacks(encounter_id,user_id,request_id,day_kst,damage,result)
 values(entry.encounter_id,u,p_request_id,day_kst,dealt,outcome);
 perform private.broadcast_association_change(aid);
 return jsonb_build_object('result',outcome,'state',private.guild_boss_state_json(u),'replayed',false);
end;$$;

revoke all on function private.guild_boss_cycle_start(text,timestamptz) from public,anon,authenticated;
revoke all on function private.guild_boss_ensure(uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function private.guild_boss_combat(uuid,private.guild_boss_encounters,jsonb) from public,anon,authenticated;
revoke all on function private.guild_boss_state_json(uuid) from public,anon,authenticated;
revoke all on function public.get_guild_boss_state(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_guild_boss_state(uuid,bigint,text,text) to authenticated;
revoke all on function public.attack_guild_boss(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.attack_guild_boss(uuid,bigint,text,text,uuid,text) to authenticated;
