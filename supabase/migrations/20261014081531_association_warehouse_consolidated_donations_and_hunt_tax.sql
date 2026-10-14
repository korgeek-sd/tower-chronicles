-- 2026-10-14: headquarters donations feed shared treasury and award contribution/EXP.
-- Save-locked instant-hunting win taxes also feed the existing shared silver treasury.
alter table private.online_association_donations drop constraint if exists online_association_donations_currency_type_check;
alter table private.online_association_donations add constraint online_association_donations_currency_type_check check(currency_type in ('SILVER','GOLD','TICKET'));
alter table private.association_warehouse_ledger drop constraint if exists association_warehouse_ledger_operation_check;
alter table private.association_warehouse_ledger add constraint association_warehouse_ledger_operation_check check(operation in ('DEPOSIT','WAR_DECLARATION','HUNT_TAX','EXPEDITION_TAX'));
revoke all on function public.deposit_association_warehouse(uuid,bigint,text,text,uuid,text,bigint) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.donate_to_association(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_currency text, p_amount bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid; a uuid; gain bigint; used bigint; unit bigint; lim bigint; w private.player_wallets%rowtype; previous private.association_operation_requests%rowtype; result jsonb; input jsonb; balance_after bigint; affected int;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'ASSOCIATION_REQUEST_REQUIRED';end if;
 if p_currency is null or p_currency not in('silver','gold','ticket') or p_amount is null or p_amount<=0 then raise exception 'ASSOCIATION_DONATION_INVALID';end if;
 unit:=case p_currency when 'silver' then 10000 when 'gold' then 100 else 1 end;lim:=case p_currency when 'silver' then 50000 when 'gold' then 1000 else 100 end;
 if p_amount%unit<>0 or p_amount>lim then raise exception 'ASSOCIATION_DONATION_INVALID';end if;
 input:=jsonb_build_object('currency',p_currency,'amount',p_amount);
 select * into previous from private.association_operation_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous.operation<>'DONATE' or previous.input<>input then raise exception 'ASSOCIATION_REQUEST_CONFLICT';end if;
  return jsonb_build_object('progression',private.association_progression_json(u),'record',private.cloud_record_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'ASSOCIATION_DURING_EXPEDITION';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into w from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select m.association_id into a from private.online_association_members m join private.online_associations x using(association_id)
 where m.user_id=u and x.status='ACTIVE' for share of m;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 perform 1 from private.online_associations where association_id=a for update;
 select coalesce(sum(amount),0) into used from private.online_association_donations
 where user_id=u and currency_type=upper(p_currency) and created_at>=private.association_period_start('DAILY');
 if used+p_amount>lim then raise exception 'ASSOCIATION_DONATION_LIMIT';end if;
 if (p_currency='silver' and w.silver<p_amount) or (p_currency='gold' and w.gold<p_amount) then raise exception 'ASSOCIATION_BALANCE_SHORTAGE';end if;
 gain:=p_amount/unit*case p_currency when 'silver' then 100 when 'gold' then 200 else 10 end;
 if p_currency='ticket' then
  update private.village_life_players set products=jsonb_set(products,'{challenge_ticket}',
   to_jsonb(coalesce((products->>'challenge_ticket')::bigint,0)-p_amount),true)
  where user_id=u and coalesce((products->>'challenge_ticket')::bigint,0)>=p_amount;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'ASSOCIATION_BALANCE_SHORTAGE';end if;
 else
  update private.player_wallets set silver=silver-case when p_currency='silver' then p_amount else 0 end,
    gold=gold-case when p_currency='gold' then p_amount else 0 end,updated_at=now() where user_id=u;
 end if;
 update private.online_associations set association_exp=association_exp+gain,
 association_level=private.association_level_from_exp(association_exp+gain),total_donation=total_donation+gain,
 treasury_silver=treasury_silver+case when p_currency='silver' then p_amount else 0 end,
 treasury_gold=treasury_gold+case when p_currency='gold' then p_amount else 0 end,
 treasury_tickets=treasury_tickets+case when p_currency='ticket' then p_amount else 0 end,
 updated_at=now() where association_id=a
 returning case p_currency when 'silver' then treasury_silver when 'gold' then treasury_gold else treasury_tickets end into balance_after;
 insert into private.association_warehouse_ledger(association_id,actor_user_id,operation,currency_type,amount,balance_after,detail)
 values(a,u,'DEPOSIT',upper(p_currency),p_amount,balance_after,'본부 기부 · 공헌도 +'||gain::text);
 insert into private.online_association_member_progression(association_id,user_id,contribution_point,total_silver_donation,total_gold_donation)
 values(a,u,gain,case when p_currency='silver' then p_amount else 0 end,case when p_currency='gold' then p_amount else 0 end)
 on conflict(association_id,user_id) do update set contribution_point=private.online_association_member_progression.contribution_point+excluded.contribution_point,
 total_silver_donation=private.online_association_member_progression.total_silver_donation+excluded.total_silver_donation,
 total_gold_donation=private.online_association_member_progression.total_gold_donation+excluded.total_gold_donation,updated_at=now();
 insert into private.online_association_donations(association_id,user_id,currency_type,amount,association_exp_gain,contribution_gain)
 values(a,u,upper(p_currency),p_amount,gain,gain);
 perform private.association_activity(a,u,'DONATION',p_amount::text||' '||upper(p_currency)||' 기부 · 경험치 +'||gain::text);
 if p_currency in ('silver','gold') then perform private.persist_server_association_to_save(u);end if;
 result:=jsonb_build_object('progression',private.association_progression_json(u),'record',private.cloud_record_json(u),'replayed',false);
 insert into private.association_operation_requests(user_id,request_id,operation,input,result) values(u,p_request_id,'DONATE',input,'{}');
 perform private.broadcast_association_change(a);
 return result;
end;$function$;

CREATE OR REPLACE FUNCTION private.association_progression_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a private.online_associations%rowtype; p private.online_association_member_progression%rowtype; s bigint; g bigint; t bigint; personal_t bigint;
begin
 select x.* into a from private.online_associations x join private.online_association_members m using(association_id)
 where m.user_id=p_user and x.status='ACTIVE';
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into p from private.online_association_member_progression where association_id=a.association_id and user_id=p_user;
 select coalesce(sum(amount) filter(where currency_type='SILVER'),0),coalesce(sum(amount) filter(where currency_type='GOLD'),0),coalesce(sum(amount) filter(where currency_type='TICKET'),0)
 into s,g,t from private.online_association_donations where user_id=p_user and created_at>=private.association_period_start('DAILY');
 select coalesce((products->>'challenge_ticket')::bigint,0) into personal_t from private.village_life_players where user_id=p_user;
 return jsonb_build_object('associationLevel',a.association_level,'associationExp',a.association_exp,
  'associationExpNext',(array[0,1000,5000,15000,30000,60000,120000,250000,500000,1000000]::bigint[])[least(10,a.association_level+1)],
  'contributionPoint',coalesce(p.contribution_point,0),'totalSilverDonation',coalesce(p.total_silver_donation,0),
  'totalGoldDonation',coalesce(p.total_gold_donation,0),'dailySilverDonation',s,'dailyGoldDonation',g,'dailyTicketDonation',t,'personalTickets',coalesce(personal_t,0),
  'dailySilverLimit',50000,'dailyGoldLimit',1000,'dailyTicketLimit',100,'dailyResetAt',private.association_period_start('DAILY')+interval '1 day');
end;$function$;

CREATE OR REPLACE FUNCTION public.hunt_once(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_map_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid;l private.village_life_players%rowtype;potions_used bigint;potions_before bigint;next_hp numeric;start_hp numeric;food text;remaining bigint;s public.game_saves%rowtype;h private.hunting_states%rowtype;r private.hunting_receipts%rowtype;
 monster jsonb;monster_action jsonb;effects jsonb:='{}';dot_kind text;dot_hit numeric;reflect_hit numeric;previous_monster text;drop_item jsonb;p jsonb;player jsonb;result jsonb;turns jsonb:='[]';lines jsonb;cd jsonb:='{}';skill text;candidate text;
 mh numeric;mhp numeric;hp numeric;attack numeric;defense numeric;ma numeric;md numeric;hit numeric;mult numeric;guard boolean;critical boolean;win boolean;turn_no integer;
 reward_silver bigint;guild_tax bigint:=0;guild_balance bigint;guild_id uuid;xp bigint;material text;monster_name text;stamp bigint:=floor(extract(epoch from now())*1000);
 mp_now numeric;mp_max numeric;spec jsonb;family text;weapon text;enhance_level integer;
 skill_power numeric;chance numeric;penetration numeric;bonus numeric;heal_amount numeric;
 shield_pts numeric:=0;shield_until integer:=0;oath_available boolean:=false;
 passive_bonus numeric:=0;passive_accuracy numeric:=0;sixth_mark boolean:=false;sixth_bonus numeric:=.15;oath_shield_bonus numeric:=.15;active_count integer:=0;
 prep_bonus numeric:=0;prep_until integer:=0;dot_pct numeric:=0;monster_dot numeric:=0;monster_dot_until integer:=0;
 monster_def_down numeric:=0;monster_def_until integer:=0;incoming numeric;absorbed numeric;
 grade_index integer;cd_interval integer;hit_count integer;hit_index integer;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'HUNT_REQUEST_REQUIRED';end if;
 if p_map_id is null or p_map_id not in ('plains','forest','mine','fortress','ruins') then raise exception 'HUNT_MAP_INVALID';end if;
 -- Match economy lock order: save -> wallet -> hunting. Account save serializes concurrent requests.
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 perform private.refresh_hunting_state(u);
 select * into h from private.hunting_states where user_id=u for update;
 select * into r from private.hunting_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.map_id<>p_map_id then raise exception 'HUNT_REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.refresh_hunting_state(u),'result',r.result,'record',private.cloud_record_json(u),'replayed',true,'serverNow',stamp);
 end if;
 perform private.refresh_village_life(u);select * into strict l from private.village_life_players where user_id=u;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') or jsonb_typeof(s.payload->'expedition') is distinct from 'null' then raise exception 'HUNT_EXPEDITION_ACTIVE';end if;
 if h.vitality<1 then raise exception 'VITALITY_EMPTY';end if;
 if p_map_id='plains' then mh:=90;ma:=12;md:=5;reward_silver:=1000+floor(random()*201)::bigint;xp:=100;material:='material:leather:1';monster_name:='가죽 갉는 하이에나';
 elsif p_map_id='forest' then mh:=130;ma:=18;md:=8;reward_silver:=1600+floor(random()*401)::bigint;xp:=250;material:='material:leather:1';monster_name:='가시 자칼';
 elsif p_map_id='mine' then mh:=180;ma:=24;md:=14;reward_silver:=2500+floor(random()*601)::bigint;xp:=600;material:='material:ore:1';monster_name:='고블린 광부';
 elsif p_map_id='fortress' then mh:=250;ma:=32;md:=20;reward_silver:=3800+floor(random()*801)::bigint;xp:=1400;material:='material:leather:1';monster_name:='무리 선봉';
 else mh:=340;ma:=42;md:=28;reward_silver:=5500+floor(random()*1001)::bigint;xp:=3000;material:='material:leather:1';monster_name:='송곳니 둥지';end if;
 previous_monster:=h.last_result->'monster'->>'id';
 monster:=private.choose_hunting_monster(p_map_id,previous_monster,random());
 mh:=(monster->>'hp')::numeric;ma:=(monster->>'attack')::numeric;md:=(monster->>'defense')::numeric;
 monster_name:=monster->>'name';

 -- Resolve equipment using the canonical inventory and no job multipliers.
 p:=jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true);
 player:=private.combat_equipment_stats(u,p);
 player:=jsonb_build_object('hp',greatest(1,(player->>'hp')::numeric),'attack',greatest(0,(player->>'attack')::numeric),'defense',greatest(0,(player->>'defense')::numeric),'critChance',greatest(0,least(1,coalesce((player->>'critChance')::numeric,.05))),'critDamage',greatest(1,coalesce((player->>'critDamage')::numeric,1.5)),'armorPenetration',greatest(0,least(1,coalesce((player->>'armorPenetration')::numeric,0))));

 -- Passive effects come from learned, equipped skill IDs; neither client data nor a forged preset can grant one.
 weapon:=coalesce(player->>'weapon','sword');
 mp_max:=100+10*coalesce((h.stat_allocation->>'mp')::integer,0);
 mp_now:=mp_max; -- every new hunt begins at full MP, regardless of the last battle.
 foreach candidate in array h.skills loop
  spec:=private.hunting_skill_spec(candidate);
  if spec is null or spec->>'type'<>'passive' or spec->>'weapon' not in ('any',weapon)
   or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate) then continue;end if;
  select enhancement_level into enhance_level from private.learned_catalog_skills where user_id=u and skill_id=candidate;
  bonus:=(spec->>'power')::numeric*(1+coalesce(enhance_level,0)*.05)/100;
  if spec->>'family'='return_oath' then
   player:=jsonb_set(player,'{hp}',to_jsonb(round((player->>'hp')::numeric*(1+bonus))),true);oath_available:=true;oath_shield_bonus:=bonus;
  elsif spec->>'family'='sixth_mark' then sixth_mark:=true;sixth_bonus:=bonus;
  elsif spec->>'family' in ('sword_mastery','bow_mastery','staff_mastery') then passive_bonus:=passive_bonus+bonus;if spec->>'family'='bow_mastery' then passive_accuracy:=passive_accuracy+bonus;end if;
  end if;
 end loop;
 hp:=greatest(1,least((player->>'hp')::numeric,coalesce(h.current_hp,(player->>'hp')::numeric)));
 potions_before:=least(coalesce((l.products->>'potion')::bigint,0),ceil(greatest(0,(player->>'hp')::numeric-hp))::bigint);
 hp:=least((player->>'hp')::numeric,hp+potions_before);start_hp:=hp;
 l.products:=jsonb_set(l.products,'{potion}',to_jsonb(coalesce((l.products->>'potion')::bigint,0)-potions_before),true);
 attack:=(player->>'attack')::numeric*case when coalesce((l.food_turns->>'attack_food')::bigint,0)>0 then 1.1 else 1 end;
 defense:=(player->>'defense')::numeric*case when coalesce((l.food_turns->>'defense_food')::bigint,0)>0 then 1.1 else 1 end;
 player:=player||jsonb_build_object('attack',attack,'defense',defense);
 if coalesce((l.food_turns->>'experience_food')::bigint,0)>0 then xp:=floor(xp*1.1);end if;
 mhp:=mh;
 for turn_no in 1..100 loop
  exit when hp<=0 or mhp<=0;
  lines:='[]';skill:=null;guard:=false;
  if monster_dot_until>=turn_no and monster_dot>0 then
   mhp:=greatest(0,mhp-monster_dot);
   lines:=lines||jsonb_build_array(monster_name||'이(가) 지속 피해 '||monster_dot::text||' 받음');
   if mhp=0 then turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp,'playerMp',mp_now));exit;end if;
  end if;
  foreach dot_kind in array array['bleed','poison','burn'] loop
   if coalesce((effects->>(dot_kind||'Until'))::integer,0)>=turn_no then
    dot_hit:=greatest(1,floor(ma*coalesce((effects->>dot_kind)::numeric,0)));
    hp:=greatest(0,hp-dot_hit);
    lines:=lines||jsonb_build_array('탐사자가 '||case dot_kind when 'bleed' then '출혈' when 'burn' then '화상' else '중독' end||'로 '||dot_hit::text||' 피해');
   end if;
  end loop;
  if hp<=0 then turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp,'playerMp',mp_now));exit;end if;

  foreach candidate in array h.skills loop
   if coalesce((effects->>'silenceUntil')::integer,0)>=turn_no
    or coalesce((effects->>'delayUntil')::integer,0)>=turn_no
    or coalesce((cd->>candidate)::integer,0)>turn_no then continue;end if;
   if candidate in ('heavy','guard','quick') then
    if candidate<>'guard' or hp/(player->>'hp')::numeric<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon)
    or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate)
    or (spec->>'mp')::numeric>mp_now then continue;end if;
   if (spec->>'family'='restore' and mp_now=mp_max)
    or (spec->>'family'='heal' and hp>=(player->>'hp')::numeric*.95)
    or (spec->>'family'='shield' and shield_pts>(player->>'hp')::numeric*.1)
    or (spec->>'family'='prepare' and prep_bonus>0) then continue;end if;
   skill:=candidate;exit;
  end loop;
  spec:=case when skill in ('heavy','guard','quick') then null else private.hunting_skill_spec(skill) end;
  if spec is not null then
   select enhancement_level into enhance_level from private.learned_catalog_skills where user_id=u and skill_id=skill;
   family:=spec->>'family';grade_index:=(spec->>'gradeIndex')::integer;
   skill_power:=(spec->>'power')::numeric*(1+coalesce(enhance_level,0)*.05);
   mp_now:=mp_now-(spec->>'mp')::numeric;active_count:=active_count+1;
   cd_interval:=case family when 'restore' then 3 when 'heal' then 4 when 'shield' then 4 when 'prepare' then 3 else 1 end;
   cd:=cd||jsonb_build_object(skill,turn_no+cd_interval);
   if random()*100 >= least(100,(spec->>'chance')::numeric+
      case when family like 'bow_%' then passive_accuracy*100 else 0 end+
      case when family='bow_shot' and grade_index=0 then 5 when family='bow_shot' and grade_index=1 then 8 else 0 end) then
    lines:=lines||jsonb_build_array('탐사자의 '||((select name from private.skill_book_catalog where skill_id=skill))||'! 발동 실패');
   elsif family='restore' then
    heal_amount:=least(mp_max-mp_now,round(skill_power));mp_now:=mp_now+heal_amount;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||'! MP +'||heal_amount::text);
   elsif family='heal' then
    heal_amount:=least((player->>'hp')::numeric-hp,floor((player->>'hp')::numeric*skill_power/100));
    hp:=hp+heal_amount;lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||'! HP +'||heal_amount::text);
   elsif family='shield' then
    shield_pts:=floor((player->>'hp')::numeric*skill_power/100);shield_until:=turn_no+2;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||'! 보호막 '||shield_pts::text);
   elsif family='prepare' then
    prep_bonus:=skill_power/100;prep_until:=turn_no+2;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||'! 다음 공격 +'||round(skill_power)::text||'%');
   else
    critical:=random()<coalesce((player->>'critChance')::numeric,.05);
    penetration:=coalesce((player->>'armorPenetration')::numeric,0);
    if family in ('sword_strike','bow_shot') then
     penetration:=least(1,penetration+case grade_index when 2 then .05 when 3 then .10 when 4 then .15 when 5 then .20 else 0 end);
    end if;
    mult:=skill_power/100*(1+passive_bonus)*(1+case when prep_until>=turn_no then prep_bonus else 0 end)*
     (case when critical then (player->>'critDamage')::numeric else 1 end);
    hit_count:=case when family='bow_volley' then case when grade_index>=5 then 4 when grade_index>=3 then 3 else 2 end else 1 end;
    hit:=0;
    for hit_index in 1..hit_count loop
     hit:=hit+private.hunting_damage(attack*(case when coalesce((effects->>'attack_downUntil')::integer,0)>=turn_no
      then 1-coalesce((effects->>'attack_down')::numeric,0) else 1 end),
      md*(1-case when monster_def_until>=turn_no then monster_def_down else 0 end),mult/hit_count,penetration);
    end loop;
    if coalesce((effects->>'shield')::numeric,0)>0 then hit:=greatest(1,floor(hit*(1-(effects->>'shield')::numeric)));end if;
    reflect_hit:=floor(hit*coalesce((effects->>'reflect')::numeric,0));
    hp:=greatest(0,hp-reflect_hit);effects:=effects||jsonb_build_object('shield',0,'reflect',0);
    mhp:=greatest(0,mhp-hit);prep_bonus:=0;prep_until:=0;
    if family in ('sword_wound','bow_volley','staff_flame') then
     dot_pct:=case family
      when 'sword_wound' then (array[8,10,12,15,18,22])[grade_index+1]
      when 'bow_volley' then (array[0,8,10,12,15,18])[grade_index+1]
      else (array[0,10,12,15,18,22])[grade_index+1] end;
     monster_dot:=floor(attack*dot_pct*(1+coalesce(enhance_level,0)*.05)/100);
     monster_dot_until:=turn_no+2;
    end if;
    if family='sword_wound' then
     hp:=least((player->>'hp')::numeric,hp+floor(hit*(array[0,.05,.07,.10,.12,.15])[grade_index+1]));
    end if;
    if family='staff_rift' then monster_def_down:=(array[3,5,8,11,15,20])[grade_index+1]*(1+coalesce(enhance_level,0)*.05)/100;monster_def_until:=turn_no+2;end if;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||
     '! '||hit::text||' 피해'||case when hit_count>1 then ' · '||hit_count::text||'연타' else '' end||case when critical then ' · 치명타' else '' end);
   end if;
   if sixth_mark and active_count%6=0 then
    mp_now:=least(mp_max,mp_now+80);prep_bonus:=greatest(prep_bonus,sixth_bonus);prep_until:=turn_no+2;
    lines:=lines||jsonb_build_array('여섯 번째 각인! MP +80');
   end if;
  else
  if skill='guard' then
   guard:=true;cd:=cd||jsonb_build_object('guard',turn_no+4);lines:=lines||jsonb_build_array('탐사자의 방어! 이번 턴 피해 50% 감소');
  elsif skill is not null then
   mult:=case skill when 'heavy' then 1.8 when 'quick' then 1.2 else 1 end;
   critical:=random()<coalesce((player->>'critChance')::numeric,.05);
   hit:=private.hunting_damage(attack*(case when coalesce((effects->>'attack_downUntil')::integer,0)>=turn_no then 1-coalesce((effects->>'attack_down')::numeric,0) else 1 end),md,mult*(case when critical then (player->>'critDamage')::numeric else 1 end),(player->>'armorPenetration')::numeric);
   if coalesce((effects->>'shield')::numeric,0)>0 then hit:=greatest(1,floor(hit*(1-(effects->>'shield')::numeric)));end if;
   reflect_hit:=floor(hit*coalesce((effects->>'reflect')::numeric,0));
   hp:=greatest(0,hp-reflect_hit);
   effects:=effects||jsonb_build_object('shield',0,'reflect',0);
   mhp:=greatest(0,mhp-hit);
   if skill is not null then cd:=cd||jsonb_build_object(skill,turn_no+case when skill='heavy' then 3 else 2 end);end if;
   lines:=lines||jsonb_build_array('탐사자의 '||case skill when 'heavy' then '강타' when 'quick' then '속공' else '공격' end||'! '||hit::text||' 피해'||case when critical then ' · 치명타' else '' end);
  else lines:=lines||jsonb_build_array(case when coalesce((effects->>'silenceUntil')::integer,0)>=turn_no or coalesce((effects->>'delayUntil')::integer,0)>=turn_no then '탐사자의 스킬이 봉인·지연되어 행동할 수 없음' else '탐사자의 대기 · 사용 가능한 스킬 없음' end);
  end if;
  end if;
  if mhp>0 and hp>0 then
   monster_action:=private.hunting_monster_action(monster,turn_no,defense*(case when coalesce((effects->>'defense_downUntil')::integer,0)>=turn_no then 1-coalesce((effects->>'defense_down')::numeric,0) else 1 end),guard,mhp,effects);
   incoming:=(monster_action->>'damage')::numeric;
   if shield_until>=turn_no and shield_pts>0 then
    absorbed:=least(incoming,shield_pts);shield_pts:=shield_pts-absorbed;incoming:=incoming-absorbed;
   end if;
   hp:=greatest(0,hp-incoming);
   if hp<=0 and oath_available then
    hp:=1;oath_available:=false;
    shield_pts:=greatest(shield_pts,floor((player->>'hp')::numeric*oath_shield_bonus));shield_until:=turn_no+2;
    lines:=lines||jsonb_build_array('귀환자의 맹세! HP 1로 생존');
   end if;
   mhp:=least(mh,mhp+coalesce((monster_action->>'heal')::numeric,0));
   effects:=monster_action->'effects';
   lines:=lines||jsonb_build_array(monster_action->>'line');
  end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp,'playerMp',mp_now));
 end loop;
 win:=mhp=0 and hp>0;
 potions_used:=least(coalesce((l.products->>'potion')::bigint,0),ceil(greatest(0,(player->>'hp')::numeric-hp))::bigint);
 next_hp:=greatest(1,least((player->>'hp')::numeric,hp+potions_used));
 l.products:=jsonb_set(l.products,'{potion}',to_jsonb(coalesce((l.products->>'potion')::bigint,0)-potions_used),true);
 potions_used:=potions_used+potions_before;
 foreach food in array array['attack_food','defense_food','experience_food'] loop
  remaining:=coalesce((l.food_turns->>food)::bigint,0);l.food_turns:=jsonb_set(l.food_turns,array[food],to_jsonb(greatest(0,remaining-1)),true);
 end loop;
 update private.village_life_players set products=l.products,food_turns=l.food_turns where user_id=u;
 if win then drop_item:=private.hunting_equipment_drop(p_map_id,floor(random()*1000000)::integer,floor(random()*9)::integer);end if;
 if win then
  select a.association_id,floor(reward_silver*greatest(0,least(30,a.revenue_share_rate_percent))/100.0)::bigint
  into guild_id,guild_tax from private.online_association_members m
  join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
  where m.user_id=u;
  guild_tax:=greatest(0,coalesce(guild_tax,0));
  if guild_id is not null and guild_tax>0 then
   update private.online_associations set treasury_silver=treasury_silver+guild_tax,updated_at=now()
   where association_id=guild_id and status='ACTIVE' returning treasury_silver into guild_balance;
   if found then
    insert into private.association_warehouse_ledger(association_id,actor_user_id,operation,currency_type,amount,balance_after,detail)
    values(guild_id,u,'HUNT_TAX','SILVER',guild_tax,guild_balance,'즉시 사냥 수익 분담 · '||p_map_id);
    perform private.association_activity(guild_id,u,'TREASURY_SHARE','사냥 수익 분담 '||guild_tax::text||' Silver 적립');
   else guild_tax:=0;
   end if;
  end if;
  reward_silver:=reward_silver-guild_tax;
 end if;
 result:=jsonb_build_object('monster',monster,'equipment',drop_item,'requestId',p_request_id,'mapId',p_map_id,'outcome',case when win then 'victory' else 'defeat' end,'player',player,'playerHp',hp,'playerMp',mp_now,'playerMaxMp',mp_max,'startHp',start_hp,'recoveredHp',next_hp,'potionsUsed',potions_used,'monsterHp',mhp,'turns',turns,'silver',case when win then reward_silver else 0 end,'guildTax',guild_tax,'exp',case when win then xp else 0 end,'mastery',case when win then 1 else 0 end,'materialCount',case when win then 1 else 0 end,'createdAt',stamp);
 if win then
  if drop_item is not null then insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||(drop_item->>'id'),1,drop_item);end if;
  update private.player_wallets set silver=private.player_wallets.silver+reward_silver,updated_at=now() where user_id=u;
  insert into private.market_assets(user_id,item_id,quantity) values(u,material,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1,updated_at=now();
 end if;
 update private.hunting_states set current_hp=next_hp,max_hp=(player->>'hp')::numeric,current_mp=mp_now,vitality=vitality-1,experience=experience+case when win then xp else 0 end,mastery=mastery+case when win then 1 else 0 end,last_result=result where user_id=u;
 insert into private.hunting_receipts(user_id,request_id,map_id,result) values(u,p_request_id,p_map_id,result);
 perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');
 return jsonb_build_object('state',private.refresh_hunting_state(u),'result',result,'record',private.cloud_record_json(u),'replayed',false,'serverNow',stamp);
end $function$;

CREATE OR REPLACE FUNCTION private.settle_online_association_side_effects()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_gross bigint:=0;
  v_share bigint:=0;
begin
  if old.status='ACTIVE' and new.status='RETURNED' then
    if old.floor=10 and coalesce(old.boss_defeated,false) then
      insert into private.player_association_eligibility(user_id,qualified,qualified_at,updated_at)
      values(new.user_id,true,now(),now())
      on conflict(user_id) do update set
        qualified=true,
        qualified_at=coalesce(private.player_association_eligibility.qualified_at,excluded.qualified_at),
        updated_at=now();
    end if;

    if old.association_id is not null and old.revenue_share_rate>0 then
      v_gross:=greatest(0,coalesce((old.temporary_loot->>'silver')::bigint,0));
      v_share:=floor(v_gross*old.revenue_share_rate/100.0);
      if v_share>0 then
        update private.online_associations
        set treasury_silver=treasury_silver+v_share,updated_at=now()
        where association_id=old.association_id and status='ACTIVE';
        if found then
          insert into private.association_warehouse_ledger(association_id,actor_user_id,operation,currency_type,amount,balance_after,detail)
          select old.association_id,new.user_id,'EXPEDITION_TAX','SILVER',v_share,treasury_silver,'원정 수익 분담'
          from private.online_associations where association_id=old.association_id;
          perform private.association_activity(
            old.association_id,new.user_id,'TREASURY_SHARE',
            '원정 수익 분담 '||v_share::text||' Silver가 원정단 금고에 적립되었습니다.'
          );
        end if;
      end if;
    end if;
  end if;
  return new;
end;$function$;
