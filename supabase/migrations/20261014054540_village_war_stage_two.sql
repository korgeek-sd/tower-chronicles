-- Authoritative five-front PvP. Activation is a separate verified release step.
alter table private.village_war_events add column settled_at timestamptz, add column winner_association_id uuid references private.online_associations(association_id) on delete set null;
create table private.village_war_intervals(
 interval_id bigint generated always as identity primary key,event_id uuid not null references private.village_war_events(event_id) on delete cascade,
 front_id int not null check(front_id between 1 and 5),association_id uuid not null references private.online_associations(association_id),
 starts_at timestamptz not null,ends_at timestamptz,check(ends_at is null or ends_at>=starts_at));
create unique index village_war_open_interval on private.village_war_intervals(event_id,front_id) where ends_at is null;
create index village_war_interval_event on private.village_war_intervals(event_id,association_id,starts_at);
create table private.village_war_battles(
 battle_id uuid primary key default gen_random_uuid(),event_id uuid not null references private.village_war_events(event_id) on delete cascade,
 front_id int not null,attacker_user_id uuid not null references auth.users(id),defender_user_id uuid not null references auth.users(id),
 created_at timestamptz not null,result jsonb not null);
create index village_war_battle_event on private.village_war_battles(event_id,created_at desc);
alter table private.village_war_intervals enable row level security;
alter table private.village_war_battles enable row level security;
revoke all on private.village_war_intervals,private.village_war_battles from public,anon,authenticated;

-- Every ownership change closes the old half-open interval before opening the new one.
create function private.village_war_track_ownership() returns trigger language plpgsql security definer set search_path='' as $$
declare e private.village_war_events%rowtype;t timestamptz;
begin
 select * into e from private.village_war_events where event_id=new.event_id;
 if not e.frozen or e.settled_at is not null then return new;end if;
 if new.association_id is distinct from old.association_id then
  t:=greatest(e.battle_starts_at,least(e.battle_ends_at,private.village_war_clock()));
  update private.village_war_intervals set ends_at=t where event_id=new.event_id and front_id=new.front_id and ends_at is null;
 end if;
 if new.association_id is not null and new.occupied_at is not null then
  insert into private.village_war_intervals(event_id,front_id,association_id,starts_at)
  values(new.event_id,new.front_id,new.association_id,greatest(e.battle_starts_at,new.occupied_at)) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.village_war_track_ownership() from public,anon,authenticated;
create trigger village_war_ownership after update on private.village_war_fronts for each row execute function private.village_war_track_ownership();

create function private.village_war_scores(eid uuid,stamp timestamptz) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('associationId',s.association_id,'associationName',a.name,'points',s.seconds/60,'fronts',s.fronts) order by s.seconds desc,s.fronts desc,s.association_id),'[]')
 from (select i.association_id,sum(greatest(0,extract(epoch from least(coalesce(i.ends_at,stamp),stamp,e.battle_ends_at)-greatest(i.starts_at,e.battle_starts_at)))) seconds,
 count(*) filter(where i.ends_at is null and i.starts_at<=stamp)::int fronts
 from private.village_war_intervals i join private.village_war_events e using(event_id) where i.event_id=eid group by i.association_id) s
 left join private.online_associations a using(association_id)
$$;
revoke all on function private.village_war_scores(uuid,timestamptz) from public,anon,authenticated;

-- Find the FIRST threshold crossing over the complete piecewise-constant ownership history.
create function private.village_war_cutoff(eid uuid,stamp timestamptz) returns timestamptz language sql stable set search_path='' as $$
 with e as(select * from private.village_war_events where event_id=eid),
 spans as(select i.association_id,greatest(i.starts_at,e.battle_starts_at) lo,least(coalesce(i.ends_at,stamp),stamp,e.battle_ends_at) hi from private.village_war_intervals i,e where i.event_id=eid and i.starts_at<least(stamp,e.battle_ends_at)),
 deltas as(select association_id,t,sum(delta) delta from (select association_id,lo t,1 delta from spans union all select association_id,hi,-1 from spans) q group by association_id,t),
 pieces as(select association_id,t,lead(t) over(partition by association_id order by t) next_t,sum(delta) over(partition by association_id order by t) rate from deltas),
 rates as(select *,coalesce(sum(rate*extract(epoch from next_t-t)) over(partition by association_id order by t rows between unbounded preceding and 1 preceding),0) accrued from pieces),
 crossings as(select t+(greatest(0,9000-accrued)/rate)*interval '1 second' t from rates where rate>0 and next_t is not null and accrued+rate*extract(epoch from next_t-t)>=9000)
 select coalesce((select min(t) from crossings),(select battle_ends_at from e))
$$;
revoke all on function private.village_war_cutoff(uuid,timestamptz) from public,anon,authenticated;

create function private.settle_village_war(eid uuid) returns void language plpgsql set search_path='' as $$
declare e private.village_war_events%rowtype;cut timestamptz;score jsonb;winner uuid;best numeric;fronts int;ties int;
begin
 select * into e from private.village_war_events where event_id=eid;
 if e.settled_at is not null then return;end if;
 cut:=private.village_war_cutoff(eid,private.village_war_clock());
 if private.village_war_clock()<cut then return;end if;
 select * into e from private.village_war_events where event_id=eid for update nowait;
 if e.settled_at is not null then return;end if;
 perform 1 from private.village_war_fronts where event_id=eid order by front_id for update nowait;
 cut:=private.village_war_cutoff(eid,private.village_war_clock());
 score:=private.village_war_scores(eid,cut);
 best:=(score->0->>'points')::numeric;fronts:=(score->0->>'fronts')::int;
 select count(*) into ties from jsonb_array_elements(score) v where (v->>'points')::numeric=best and (v->>'fronts')::int=fronts;
 if ties=1 and best>0 then winner:=(score->0->>'associationId')::uuid;end if;
 update private.village_war_events set settled_at=cut,battle_ends_at=cut,winner_association_id=winner where event_id=eid;
 insert into private.village_war_owners(town_id,association_id,occupied_at) values(e.town_id,coalesce(winner,e.owner_association_id),cut)
 on conflict(town_id) do update set association_id=excluded.association_id,occupied_at=excluded.occupied_at;
 -- Actor eligibility is derived from event end time; no reversed actor-lock order here.
exception when lock_not_available then raise exception 'WAR_EVENT_BUSY';
end $$;
revoke all on function private.settle_village_war(uuid) from public,anon,authenticated;

create function private.refresh_village_war_actor_event(u uuid) returns void language plpgsql set search_path='' as $$
declare eid uuid;e private.village_war_events%rowtype;
begin
 select event_id into eid from private.village_war_actor_state where user_id=u;
 if eid is null then return;end if;
 select * into e from private.village_war_events where event_id=eid;
 if e.settled_at is not null or private.village_war_clock()<e.battle_starts_at then return;end if;
 if not e.frozen then
  perform 1 from private.village_war_events where event_id=eid for update nowait;
  perform 1 from private.village_war_fronts where event_id=eid order by front_id for update nowait;
  update private.village_war_events set frozen=true where event_id=eid;
  update private.village_war_fronts set occupied_at=e.battle_starts_at where event_id=eid and defender_user_id is not null and occupied_at is null;
 end if;
 perform private.settle_village_war(eid);
exception when lock_not_available then raise exception 'WAR_EVENT_BUSY';
end $$;
revoke all on function private.refresh_village_war_actor_event(uuid) from public,anon,authenticated;

alter function public.get_village_war_state(uuid,bigint,text,text,text) rename to get_village_war_state_stage_one;
revoke all on function public.get_village_war_state_stage_one(uuid,bigint,text,text,text) from public,anon,authenticated;
create function public.get_village_war_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_town_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;eid uuid;u uuid;e private.village_war_events%rowtype;records jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform private.refresh_village_war_actor_event(u);
 s:=public.get_village_war_state_stage_one(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_town_id);
 if not (s->>'enabled')::boolean then return s;end if;
 eid:=(s->>'eventId')::uuid;perform private.settle_village_war(eid);
 select * into e from private.village_war_events where event_id=eid;
 s:=public.get_village_war_state_stage_one(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_town_id);
 select coalesce(jsonb_agg(v.record order by v.created_at desc),'[]') into records from
 (select created_at,jsonb_build_object('battleId',battle_id,'frontId',front_id,'createdAt',created_at,'attackerName',result->>'attackerName','defenderName',result->>'defenderName','outcome',result->>'outcome','defenderHp',result->'defenderHp','defenderReward',result->'defenderReward') record from private.village_war_battles where event_id=eid order by created_at desc,battle_id limit 20) v;
 return s||jsonb_build_object('scores',private.village_war_scores(eid,coalesce(e.settled_at,private.village_war_clock())),'settledAt',e.settled_at,'winnerAssociationId',e.winner_association_id,'ownerAssociationId',coalesce((select association_id from private.village_war_owners where town_id=p_town_id),e.owner_association_id),'recentBattles',records,'stageTwo',true);
end $$;
revoke all on function public.get_village_war_state(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.get_village_war_state(uuid,bigint,text,text,text) to authenticated;

-- Keep the original deployment/claim implementation, with a shared event gate.
alter function private.village_war_mutate(uuid,uuid,text,int,bigint,text,uuid) rename to village_war_mutate_stage_one;
-- PL/pgSQL self-qualified parameters must follow the renamed function.
do $$begin execute replace(pg_get_functiondef('private.village_war_mutate_stage_one(uuid,uuid,text,int,bigint,text,uuid)'::regprocedure),'village_war_mutate.request_id','village_war_mutate_stage_one.request_id');end $$;
create function private.village_war_mutate(u uuid,request_id uuid,town text,front int,epoch bigint,action text,expected_event uuid) returns jsonb language plpgsql set search_path='' as $$
declare eid uuid;r jsonb;e private.village_war_events%rowtype;
begin
 -- Original receipts remain readable after settlement without another charge.
 if exists(select 1 from private.village_war_receipts v where v.user_id=u and v.request_id=village_war_mutate.request_id) then
  return private.village_war_mutate_stage_one(u,request_id,town,front,epoch,action,expected_event);
 end if;
 perform private.refresh_village_war_actor_event(u);
 eid:=private.village_war_event(town);
 select * into e from private.village_war_events where event_id=eid for share nowait;
 if e.settled_at is not null or private.village_war_clock()>=private.village_war_cutoff(eid,private.village_war_clock()) then raise exception 'WAR_ENDED';end if;
 r:=private.village_war_mutate_stage_one(u,request_id,town,front,epoch,action,expected_event);
 if private.village_war_clock()>=private.village_war_cutoff(eid,private.village_war_clock()) then raise exception 'WAR_ENDED';end if;
 return r;
exception when lock_not_available then raise exception 'WAR_EVENT_BUSY';
end $$;
revoke all on function private.village_war_mutate(uuid,uuid,text,int,bigint,text,uuid) from public,anon,authenticated;

create function private.village_war_random() returns double precision language sql volatile set search_path='' as $$select random()$$;
revoke all on function private.village_war_random() from public,anon,authenticated;

-- Share the authored 80-skill catalog and enhancement math with hunting.
create function private.village_war_prepare(s jsonb) returns jsonb language plpgsql set search_path='' as $$
declare item jsonb;spec jsonb;bonus numeric;weapon text:=coalesce(s->'stats'->>'weapon','sword');active jsonb:='[]';traits jsonb:='{"damage":0,"accuracy":0,"oath":false,"oathRatio":0,"sixth":false,"sixthRatio":0}';maxhp numeric:=(s->>'maxHp')::numeric;passives int:=0;
begin
 if s ? 'combatTraits' then return s;end if;
 for item in select value from jsonb_array_elements(coalesce(s->'skills','[]')) loop
  spec:=private.hunting_skill_spec(item->>'id');
  if spec is null or spec->>'weapon' not in('any',weapon) then continue;end if;
  if spec->>'type'='passive' and passives<3 then
   passives:=passives+1;bonus:=(spec->>'power')::numeric*(1+greatest(0,least(3,coalesce((item->>'enhancement')::int,0)))*.05)/100;
   if spec->>'family'='return_oath' then maxhp:=round(maxhp*(1+bonus));traits:=traits||jsonb_build_object('oath',true,'oathRatio',bonus);
   elsif spec->>'family'='sixth_mark' then traits:=traits||jsonb_build_object('sixth',true,'sixthRatio',bonus);
   else traits:=traits||jsonb_build_object('damage',(traits->>'damage')::numeric+bonus,'accuracy',(traits->>'accuracy')::numeric+case when spec->>'family'='bow_mastery' then bonus else 0 end);end if;
  end if;
 end loop;
 -- Preserve the complete ordered preset, including legacy skills in mixed presets.
 for item in select value from jsonb_array_elements(case when jsonb_array_length(coalesce(s->'loadout','[]'))>0 then s->'loadout' else coalesce((select jsonb_agg(v->'id') from jsonb_array_elements(coalesce(s->'skills','[]')) v),'[]') end) loop
  if jsonb_array_length(active)>=6 then exit;end if;
  if item#>>'{}' in('heavy','quick','guard') then
   active:=active||jsonb_build_array(jsonb_build_object('id',item#>>'{}','enhancement',0));
  else
   spec:=private.hunting_skill_spec(item#>>'{}');
   if spec->>'type'='active' and spec->>'weapon' in('any',weapon) then
    select v into item from jsonb_array_elements(coalesce(s->'skills','[]')) v where v->>'id'=item#>>'{}';
    if item is not null then active:=active||jsonb_build_array(item);end if;
   end if;
  end if;
 end loop;
 return s||jsonb_build_object('maxHp',maxhp,'combatTraits',traits,'activeSkills',active);
end $$;
revoke all on function private.village_war_prepare(jsonb) from public,anon,authenticated;
alter function private.village_war_snapshot(uuid) rename to village_war_snapshot_stage_one;
create function private.village_war_snapshot(u uuid) returns jsonb language sql set search_path='' as $$select private.village_war_prepare(private.village_war_snapshot_stage_one(u))$$;
revoke all on function private.village_war_snapshot(uuid) from public,anon,authenticated;

create function private.village_war_fighter(s jsonb,hp numeric,mp numeric) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('snapshot',private.village_war_prepare(s),'hp',hp,'mp',mp,'cursor',0,'count',0,'cd','{}'::jsonb,'shield',0,'shieldUntil',0,'prep',0,'prepUntil',0,'dot',0,'dotFrom',0,'dotUntil',0,'guardUntil',0,'guard',false,'defDown',0,'defUntil',0,'oath',(private.village_war_prepare(s)->'combatTraits'->>'oath')::boolean)
$$;
revoke all on function private.village_war_fighter(jsonb,numeric,numeric) from public,anon,authenticated;

create function private.village_war_damage(f jsonb,amount numeric,turn_no int) returns jsonb language plpgsql set search_path='' as $$
declare hp numeric;shield numeric:=case when (f->>'shieldUntil')::int>=turn_no then (f->>'shield')::numeric else 0 end;absorbed numeric;s jsonb:=f->'snapshot';
begin
 if coalesce((f->>'guard')::boolean,false) and coalesce((f->>'guardUntil')::int,0)>=turn_no then amount:=floor(amount*.5);f:=f||jsonb_build_object('guard',false);end if;
 absorbed:=least(shield,amount);hp:=greatest(0,(f->>'hp')::numeric-(amount-absorbed));shield:=shield-absorbed;
 if hp<=0 and (f->>'oath')::boolean then
  hp:=1;shield:=greatest(shield,floor((s->>'maxHp')::numeric*(s->'combatTraits'->>'oathRatio')::numeric));
  f:=f||jsonb_build_object('oath',false,'shieldUntil',turn_no+2);
 end if;
 return f||jsonb_build_object('hp',hp,'shield',shield);
end $$;
revoke all on function private.village_war_damage(jsonb,numeric,int) from public,anon,authenticated;

-- One symmetric actor step. No user tables or PvE food/potions are read here.
create function private.village_war_step(a jsonb,b jsonb,turn_no int) returns jsonb language plpgsql set search_path='' as $$
declare s jsonb:=a->'snapshot';t jsonb:=b->'snapshot';actives jsonb:=s->'activeSkills';item jsonb;spec jsonb;id text;family text;idx int;cursor int:=(a->>'cursor')::int;n int:=jsonb_array_length(actives);power numeric;grade int;cost numeric;chance numeric;cd int;hp numeric:=(a->>'hp')::numeric;mp numeric:=(a->>'mp')::numeric;shield numeric;hit numeric:=0;mult numeric;pen numeric;hits int;crit boolean;line text;lines jsonb:='[]';i int;dotpct numeric;chosen boolean:=false;traits jsonb:=s->'combatTraits';
begin
 if (a->>'dotUntil')::int>=turn_no and coalesce((a->>'dotFrom')::int,0)<=turn_no and (a->>'dot')::numeric>0 then
  a:=private.village_war_damage(a,(a->>'dot')::numeric,turn_no);hp:=(a->>'hp')::numeric;
  lines:=lines||jsonb_build_array((s->>'name')||' 지속 피해 '||(a->>'dot'));
 end if;
 if hp<=0 then return jsonb_build_object('a',a,'b',b,'lines',lines);end if;
 if (a->>'prepUntil')::int<turn_no then a:=a||jsonb_build_object('prep',0);end if;
 if (a->>'shieldUntil')::int<turn_no then a:=a||jsonb_build_object('shield',0);end if;
 for i in 0..greatest(-1,n-1) loop
  idx:=(cursor+i)%n;item:=actives->idx;id:=item->>'id';spec:=private.hunting_skill_spec(id);
  if coalesce((a->'cd'->>id)::int,0)>turn_no then continue;end if;
  if id in('heavy','quick','guard') then
   if id='guard' and hp>(s->>'maxHp')::numeric*.5 then continue;end if;
   chosen:=true;exit;
  end if;
  if spec is null or (spec->>'mp')::numeric>mp then continue;end if;
  family:=spec->>'family';
  if family='restore' and mp>=(s->>'maxMp')::numeric or family='heal' and hp>=(s->>'maxHp')::numeric*.95
   or family='shield' and (a->>'shield')::numeric>(s->>'maxHp')::numeric*.1
   or family='prepare' and (a->>'prep')::numeric>0 then continue;end if;
  chosen:=true;exit;
 end loop;
 -- The chosen item must satisfy its conditions; the loop may exhaust all candidates.
 if not chosen then item:=null;end if;
 if item is null then return jsonb_build_object('a',a,'b',b,'lines',lines||jsonb_build_array((s->>'name')||' 대기 · 사용 가능한 스킬 없음'));end if;
 id:=item->>'id';spec:=private.hunting_skill_spec(id);family:=coalesce(spec->>'family',id);grade:=coalesce((spec->>'gradeIndex')::int,0);
 power:=coalesce((spec->>'power')::numeric,case id when 'heavy' then 180 when 'quick' then 120 else 0 end)*(1+greatest(0,least(3,coalesce((item->>'enhancement')::int,0)))*.05);
 cost:=coalesce((spec->>'mp')::numeric,0);mp:=mp-cost;
 cd:=case family when 'restore' then 3 when 'heal' then 4 when 'shield' then 4 when 'prepare' then 3 when 'guard' then 4 when 'heavy' then 3 when 'quick' then 2 else 1 end;
 a:=a||jsonb_build_object('cursor',(idx+1)%n,'count',(a->>'count')::int+1,'mp',mp,'cd',a->'cd'||jsonb_build_object(id,turn_no+cd));
 line:=(s->>'name')||' · '||id;
 chance:=least(100,coalesce((spec->>'chance')::numeric,100)+case when family like 'bow_%' then (traits->>'accuracy')::numeric*100 else 0 end+case when family='bow_shot' and grade=0 then 5 when family='bow_shot' and grade=1 then 8 else 0 end);
 if private.village_war_random()*100>=chance then line:=line||' 발동 실패';
 elsif family='restore' then mp:=least((s->>'maxMp')::numeric,mp+round(power));a:=a||jsonb_build_object('mp',mp);line:=line||' MP 회복';
 elsif family='heal' then hp:=least((s->>'maxHp')::numeric,hp+floor((s->>'maxHp')::numeric*power/100));a:=a||jsonb_build_object('hp',hp);line:=line||' HP 회복';
 elsif family='guard' then a:=a||jsonb_build_object('guard',true,'guardUntil',turn_no+1);line:=line||' 다음 공격 피해 50% 감소';
 elsif family='shield' then a:=a||jsonb_build_object('shield',floor((s->>'maxHp')::numeric*power/100),'shieldUntil',turn_no+2);line:=line||' 보호막';
 elsif family='prepare' then a:=a||jsonb_build_object('prep',power/100,'prepUntil',turn_no+2);line:=line||' 다음 공격 준비';
 else
  crit:=private.village_war_random()<coalesce((s->'stats'->>'critChance')::numeric,.05);
  pen:=least(1,coalesce((s->'stats'->>'armorPenetration')::numeric,0)+case when family in('sword_strike','bow_shot') then (array[0,0,.05,.10,.15,.20])[grade+1] else 0 end);
  mult:=power/100*(1+(traits->>'damage')::numeric)*(1+(a->>'prep')::numeric)*case when crit then coalesce((s->'stats'->>'critDamage')::numeric,1.5) else 1 end;
  hits:=case when family='bow_volley' then case when grade=5 then 4 when grade>=3 then 3 else 2 end else 1 end;
  for i in 1..hits loop hit:=hit+private.hunting_damage((s->'stats'->>'attack')::numeric,(t->'stats'->>'defense')::numeric*(1-case when (b->>'defUntil')::int>=turn_no then (b->>'defDown')::numeric else 0 end),mult/hits,pen);end loop;
  b:=private.village_war_damage(b,hit,turn_no);a:=a||jsonb_build_object('prep',0,'prepUntil',0);
  if family in('sword_wound','bow_volley','staff_flame') then
   dotpct:=case family when 'sword_wound' then (array[8,10,12,15,18,22])[grade+1] when 'bow_volley' then (array[0,8,10,12,15,18])[grade+1] else (array[0,10,12,15,18,22])[grade+1] end;
   b:=b||jsonb_build_object('dot',floor((s->'stats'->>'attack')::numeric*dotpct*(1+greatest(0,least(3,coalesce((item->>'enhancement')::int,0)))*.05)/100),'dotFrom',turn_no+1,'dotUntil',turn_no+2);
  end if;
  if family='sword_wound' then a:=a||jsonb_build_object('hp',least((s->>'maxHp')::numeric,hp+floor(hit*(array[0,.05,.07,.10,.12,.15])[grade+1])));end if;
  if family='staff_rift' then b:=b||jsonb_build_object('defDown',(array[3,5,8,11,15,20])[grade+1]*(1+greatest(0,least(3,coalesce((item->>'enhancement')::int,0)))*.05)/100,'defUntil',turn_no+2);end if;
  line:=line||' '||hit||' 피해'||case when hits>1 then ' · '||hits||'연타' else '' end||case when crit then ' · 치명타' else '' end;
 end if;
 if (traits->>'sixth')::boolean and (a->>'count')::int%6=0 then a:=a||jsonb_build_object('mp',least((s->>'maxMp')::numeric,(a->>'mp')::numeric+80),'prep',greatest((a->>'prep')::numeric,(traits->>'sixthRatio')::numeric),'prepUntil',turn_no+2);line:=line||' · 각인 MP +80';end if;
 return jsonb_build_object('a',a,'b',b,'lines',lines||jsonb_build_array(line));
end $$;
revoke all on function private.village_war_step(jsonb,jsonb,int) from public,anon,authenticated;

create function private.village_war_combat(attacker jsonb,defender jsonb,def_hp numeric,def_mp numeric) returns jsonb language plpgsql set search_path='' as $$
declare a jsonb:=private.village_war_fighter(attacker,(attacker->>'maxHp')::numeric,(attacker->>'maxMp')::numeric);b jsonb:=private.village_war_fighter(defender,def_hp,def_mp);step jsonb;turns jsonb:='[]';lines jsonb;round_no int;
begin
 for round_no in 1..100 loop
  step:=private.village_war_step(a,b,round_no);a:=step->'a';b:=step->'b';lines:=step->'lines';
  if (a->>'hp')::numeric>0 and (b->>'hp')::numeric>0 then step:=private.village_war_step(b,a,round_no);b:=step->'a';a:=step->'b';lines:=lines||(step->'lines');end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',round_no,'lines',lines,'attackerHp',a->'hp','attackerMp',a->'mp','defenderHp',b->'hp','defenderMp',b->'mp'));
  exit when (a->>'hp')::numeric<=0 or (b->>'hp')::numeric<=0;
 end loop;
 return jsonb_build_object('outcome',case when (b->>'hp')::numeric<=0 and (a->>'hp')::numeric>0 then 'CAPTURE' else 'DEFENDED' end,'attackerName',attacker->>'name','defenderName',defender->>'name','attackerHp',a->'hp','attackerMp',a->'mp','attackerMaxHp',attacker->'maxHp','attackerMaxMp',attacker->'maxMp','defenderHp',b->'hp','defenderMp',b->'mp','defenderMaxHp',defender->'maxHp','defenderMaxMp',defender->'maxMp','turns',turns);
end $$;
revoke all on function private.village_war_combat(jsonb,jsonb,numeric,numeric) from public,anon,authenticated;

create function public.attack_village_war_front(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_town_id text,p_front_id int,p_expected_epoch bigint,p_expected_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;eid uuid;e private.village_war_events%rowtype;actor private.village_war_actor_state%rowtype;f private.village_war_fronts%rowtype;aid uuid;r private.village_war_receipts%rowtype;payload jsonb;s jsonb;battle jsonb;result jsonb;stamp timestamptz;reward int:=0;win boolean;target uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_expected_event_id is null or p_front_id is null or p_front_id not between 1 and 5 or p_expected_epoch is null or p_expected_epoch<0 then raise exception 'WAR_REQUEST_INVALID';end if;
 payload:=jsonb_build_object('eventId',p_expected_event_id,'townId',p_town_id,'frontId',p_front_id,'expectedEpoch',p_expected_epoch,'action','ATTACK');
 if not pg_try_advisory_xact_lock(hashtextextended('village-request:'||u::text||':'||p_request_id::text,0)) then raise exception 'WAR_REQUEST_BUSY';end if;
 select * into r from private.village_war_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.request<>payload then raise exception 'WAR_REQUEST_CONFLICT';end if;
  return jsonb_build_object('result',r.result,'replayed',true,'state',public.get_village_war_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_town_id));
 end if;
 perform private.refresh_village_war_actor_event(u);
 eid:=private.village_war_event(p_town_id);if eid<>p_expected_event_id then raise exception 'WAR_EVENT_CHANGED';end if;
 select * into e from private.village_war_events where event_id=eid for share nowait;
 stamp:=private.village_war_clock();
 if e.settled_at is not null or stamp>=private.village_war_cutoff(eid,stamp) then raise exception 'WAR_ENDED';end if;
 if stamp<e.battle_starts_at then raise exception 'WAR_PHASE_INVALID';end if;
 select m.association_id into aid from private.online_association_members m join private.online_associations g using(association_id) where m.user_id=u and g.status='ACTIVE' for share of m;
 if aid is null then raise exception 'WAR_GUILD_REQUIRED';end if;
 if aid is distinct from e.owner_association_id and not exists(select 1 from private.village_war_declarations where cycle_key=e.cycle_key and town_id=p_town_id and association_id=aid) then raise exception 'WAR_NOT_DECLARED';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('village-actor:'||u::text,0)) then raise exception 'WAR_ACTOR_BUSY';end if;
 insert into private.village_war_actor_state(user_id) values(u) on conflict(user_id) do nothing;
 select * into actor from private.village_war_actor_state where user_id=u for update nowait;
 if actor.event_id is not null and exists(select 1 from private.village_war_events where event_id=actor.event_id and battle_ends_at>stamp and settled_at is null) then raise exception 'WAR_ALREADY_DEFENDING';end if;
 if actor.next_attack_at>stamp then raise exception 'WAR_ATTACK_COOLDOWN';end if;
 s:=private.village_war_snapshot(u);
 begin select * into f from private.village_war_fronts where event_id=eid and front_id=p_front_id for update nowait;
 exception when lock_not_available then raise exception 'WAR_FRONT_BUSY';end;
 if f.defender_epoch<>p_expected_epoch then raise exception 'WAR_DEFENDER_CHANGED';end if;
 if f.defender_user_id is null then raise exception 'WAR_FRONT_EMPTY';end if;
 if f.association_id=aid then raise exception 'WAR_SAME_GUILD';end if;
 target:=f.defender_user_id;
 if not pg_try_advisory_xact_lock(hashtextextended('village-actor:'||target::text,0)) then raise exception 'WAR_ACTOR_BUSY';end if;
 perform 1 from private.village_war_actor_state where user_id=target for update nowait;
 -- Both wallets are pinned in UUID order; no waiting while holding the front.
 perform 1 from private.village_life_players where user_id in(u,target) order by user_id for update nowait;
 if coalesce((select (products->>'challenge_ticket')::bigint from private.village_life_players where user_id=u),0)<1 then raise exception 'WAR_TICKETS_SHORT';end if;
 stamp:=private.village_war_clock();if stamp>=private.village_war_cutoff(eid,stamp) then raise exception 'WAR_ENDED';end if;
 battle:=private.village_war_combat(s,f.snapshot,f.hp,f.mp);win:=battle->>'outcome'='CAPTURE';
 stamp:=private.village_war_clock();if stamp>=private.village_war_cutoff(eid,stamp) then raise exception 'WAR_ENDED';end if;
 update private.village_life_players set products=jsonb_set(products,'{challenge_ticket}',to_jsonb((products->>'challenge_ticket')::bigint-1),true) where user_id=u;
 if win then
  update private.village_war_actor_state set event_id=null,front_id=null where user_id=target and event_id=eid and front_id=p_front_id;
  update private.village_war_fronts set association_id=aid,defender_user_id=u,snapshot=s,hp=(s->>'maxHp')::numeric,max_hp=(s->>'maxHp')::numeric,mp=(s->>'maxMp')::numeric,max_mp=(s->>'maxMp')::numeric,occupied_at=stamp,defender_epoch=defender_epoch+1,revision=revision+1 where event_id=eid and front_id=p_front_id;
 else
  update private.village_war_fronts set hp=(battle->>'defenderHp')::numeric,mp=(battle->>'defenderMp')::numeric,revision=revision+1 where event_id=eid and front_id=p_front_id;
  if private.village_war_random()<.5 then
   update private.village_life_players set products=jsonb_set(products,'{challenge_ticket}',to_jsonb(coalesce((products->>'challenge_ticket')::bigint,0)+1),true) where user_id=target;
   if found then reward:=1;end if;
  end if;
 end if;
 update private.village_war_actor_state set event_id=case when win then eid else null end,front_id=case when win then p_front_id else null end,next_attack_at=stamp+interval '30 seconds' where user_id=u;
 battle:=battle||jsonb_build_object('defenderReward',reward);
 result:=jsonb_build_object('action','ATTACK','frontId',p_front_id,'defenderEpoch',p_expected_epoch+case when win then 1 else 0 end,'ticketsSpent',1,'cooldownUntil',stamp+interval '30 seconds','battle',battle);
 insert into private.village_war_battles(event_id,front_id,attacker_user_id,defender_user_id,created_at,result) values(eid,p_front_id,u,target,stamp,battle);
 insert into private.village_war_receipts values(u,p_request_id,payload,result,stamp);
 return jsonb_build_object('result',result,'replayed',false,'state',public.get_village_war_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_town_id));
exception when lock_not_available then raise exception 'WAR_ACTOR_BUSY';
end $$;
revoke all on function public.attack_village_war_front(uuid,bigint,text,text,uuid,text,int,bigint,uuid) from public,anon;
grant execute on function public.attack_village_war_front(uuid,bigint,text,text,uuid,text,int,bigint,uuid) to authenticated;

create function private.settle_village_wars() returns void language plpgsql security definer set search_path='' as $$
declare e record;
begin
 if not exists(select 1 from private.village_war_settings where enabled) then return;end if;
 for e in select event_id,battle_starts_at,frozen from private.village_war_events where settled_at is null and battle_starts_at<=private.village_war_clock() loop
  begin
   if not e.frozen then
    perform 1 from private.village_war_events where event_id=e.event_id for update nowait;
    perform 1 from private.village_war_fronts where event_id=e.event_id order by front_id for update nowait;
    update private.village_war_events set frozen=true where event_id=e.event_id;
    update private.village_war_fronts set occupied_at=e.battle_starts_at where event_id=e.event_id and defender_user_id is not null and occupied_at is null;
   end if;
   perform private.settle_village_war(e.event_id);exception when lock_not_available then null;when raise_exception then if SQLERRM<>'WAR_EVENT_BUSY' then raise;end if;end;
 end loop;
end $$;
revoke all on function private.settle_village_wars() from public,anon,authenticated;
-- Production cron extension is verified before activation; fixtures do not install cron.
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('village-war-settlement','* * * * *','select private.settle_village_wars()');
 end if;
end $$;
