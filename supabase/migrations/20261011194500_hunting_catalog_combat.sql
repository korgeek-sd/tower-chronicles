-- Player catalog combat: 60 actives + 20 passives, MP refreshed every hunt, no MP potion.
-- This migration deliberately preserves hunt receipts, rewards, session checks and lock order.
alter table private.hunting_states add column if not exists current_mp numeric;
create or replace function private.hunting_skill_spec(p_id text) returns jsonb language sql immutable set search_path='' as $spec$
 select ($json${"sword_strike_c":{"family":"sword_strike","weapon":"sword","type":"active","mp":0,"power":75,"chance":100,"gradeIndex":0},"sword_strike_b":{"family":"sword_strike","weapon":"sword","type":"active","mp":25,"power":130,"chance":90,"gradeIndex":1},"sword_strike_a":{"family":"sword_strike","weapon":"sword","type":"active","mp":45,"power":165,"chance":92,"gradeIndex":2},"sword_strike_s":{"family":"sword_strike","weapon":"sword","type":"active","mp":75,"power":205,"chance":94,"gradeIndex":3},"sword_strike_sr":{"family":"sword_strike","weapon":"sword","type":"active","mp":115,"power":250,"chance":96,"gradeIndex":4},"sword_strike_ssr":{"family":"sword_strike","weapon":"sword","type":"active","mp":170,"power":300,"chance":98,"gradeIndex":5},"sword_wound_c":{"family":"sword_wound","weapon":"sword","type":"active","mp":15,"power":70,"chance":85,"gradeIndex":0},"sword_wound_b":{"family":"sword_wound","weapon":"sword","type":"active","mp":30,"power":105,"chance":88,"gradeIndex":1},"sword_wound_a":{"family":"sword_wound","weapon":"sword","type":"active","mp":55,"power":135,"chance":91,"gradeIndex":2},"sword_wound_s":{"family":"sword_wound","weapon":"sword","type":"active","mp":90,"power":170,"chance":94,"gradeIndex":3},"sword_wound_sr":{"family":"sword_wound","weapon":"sword","type":"active","mp":135,"power":210,"chance":97,"gradeIndex":4},"sword_wound_ssr":{"family":"sword_wound","weapon":"sword","type":"active","mp":200,"power":255,"chance":100,"gradeIndex":5},"bow_shot_c":{"family":"bow_shot","weapon":"bow","type":"active","mp":0,"power":70,"chance":100,"gradeIndex":0},"bow_shot_b":{"family":"bow_shot","weapon":"bow","type":"active","mp":25,"power":125,"chance":90,"gradeIndex":1},"bow_shot_a":{"family":"bow_shot","weapon":"bow","type":"active","mp":45,"power":155,"chance":92,"gradeIndex":2},"bow_shot_s":{"family":"bow_shot","weapon":"bow","type":"active","mp":75,"power":190,"chance":94,"gradeIndex":3},"bow_shot_sr":{"family":"bow_shot","weapon":"bow","type":"active","mp":115,"power":230,"chance":96,"gradeIndex":4},"bow_shot_ssr":{"family":"bow_shot","weapon":"bow","type":"active","mp":170,"power":275,"chance":98,"gradeIndex":5},"bow_volley_c":{"family":"bow_volley","weapon":"bow","type":"active","mp":15,"power":80,"chance":85,"gradeIndex":0},"bow_volley_b":{"family":"bow_volley","weapon":"bow","type":"active","mp":30,"power":120,"chance":88,"gradeIndex":1},"bow_volley_a":{"family":"bow_volley","weapon":"bow","type":"active","mp":55,"power":150,"chance":91,"gradeIndex":2},"bow_volley_s":{"family":"bow_volley","weapon":"bow","type":"active","mp":90,"power":185,"chance":94,"gradeIndex":3},"bow_volley_sr":{"family":"bow_volley","weapon":"bow","type":"active","mp":135,"power":225,"chance":97,"gradeIndex":4},"bow_volley_ssr":{"family":"bow_volley","weapon":"bow","type":"active","mp":200,"power":270,"chance":100,"gradeIndex":5},"staff_flame_c":{"family":"staff_flame","weapon":"staff","type":"active","mp":0,"power":70,"chance":100,"gradeIndex":0},"staff_flame_b":{"family":"staff_flame","weapon":"staff","type":"active","mp":25,"power":120,"chance":90,"gradeIndex":1},"staff_flame_a":{"family":"staff_flame","weapon":"staff","type":"active","mp":45,"power":150,"chance":92,"gradeIndex":2},"staff_flame_s":{"family":"staff_flame","weapon":"staff","type":"active","mp":75,"power":185,"chance":94,"gradeIndex":3},"staff_flame_sr":{"family":"staff_flame","weapon":"staff","type":"active","mp":115,"power":225,"chance":96,"gradeIndex":4},"staff_flame_ssr":{"family":"staff_flame","weapon":"staff","type":"active","mp":170,"power":270,"chance":98,"gradeIndex":5},"staff_rift_c":{"family":"staff_rift","weapon":"staff","type":"active","mp":15,"power":70,"chance":90,"gradeIndex":0},"staff_rift_b":{"family":"staff_rift","weapon":"staff","type":"active","mp":30,"power":110,"chance":92,"gradeIndex":1},"staff_rift_a":{"family":"staff_rift","weapon":"staff","type":"active","mp":55,"power":145,"chance":94,"gradeIndex":2},"staff_rift_s":{"family":"staff_rift","weapon":"staff","type":"active","mp":90,"power":185,"chance":96,"gradeIndex":3},"staff_rift_sr":{"family":"staff_rift","weapon":"staff","type":"active","mp":135,"power":230,"chance":98,"gradeIndex":4},"staff_rift_ssr":{"family":"staff_rift","weapon":"staff","type":"active","mp":200,"power":280,"chance":100,"gradeIndex":5},"shield_c":{"family":"shield","weapon":"any","type":"active","mp":10,"power":6,"chance":100,"gradeIndex":0},"shield_b":{"family":"shield","weapon":"any","type":"active","mp":20,"power":9,"chance":100,"gradeIndex":1},"shield_a":{"family":"shield","weapon":"any","type":"active","mp":35,"power":13,"chance":100,"gradeIndex":2},"shield_s":{"family":"shield","weapon":"any","type":"active","mp":55,"power":18,"chance":100,"gradeIndex":3},"shield_sr":{"family":"shield","weapon":"any","type":"active","mp":80,"power":24,"chance":100,"gradeIndex":4},"shield_ssr":{"family":"shield","weapon":"any","type":"active","mp":110,"power":31,"chance":100,"gradeIndex":5},"heal_c":{"family":"heal","weapon":"any","type":"active","mp":20,"power":6,"chance":100,"gradeIndex":0},"heal_b":{"family":"heal","weapon":"any","type":"active","mp":35,"power":10,"chance":100,"gradeIndex":1},"heal_a":{"family":"heal","weapon":"any","type":"active","mp":55,"power":15,"chance":100,"gradeIndex":2},"heal_s":{"family":"heal","weapon":"any","type":"active","mp":80,"power":21,"chance":100,"gradeIndex":3},"heal_sr":{"family":"heal","weapon":"any","type":"active","mp":110,"power":28,"chance":100,"gradeIndex":4},"heal_ssr":{"family":"heal","weapon":"any","type":"active","mp":150,"power":36,"chance":100,"gradeIndex":5},"restore_c":{"family":"restore","weapon":"any","type":"active","mp":0,"power":25,"chance":100,"gradeIndex":0},"restore_b":{"family":"restore","weapon":"any","type":"active","mp":0,"power":40,"chance":100,"gradeIndex":1},"restore_a":{"family":"restore","weapon":"any","type":"active","mp":0,"power":60,"chance":100,"gradeIndex":2},"restore_s":{"family":"restore","weapon":"any","type":"active","mp":0,"power":85,"chance":100,"gradeIndex":3},"restore_sr":{"family":"restore","weapon":"any","type":"active","mp":0,"power":115,"chance":100,"gradeIndex":4},"restore_ssr":{"family":"restore","weapon":"any","type":"active","mp":0,"power":150,"chance":100,"gradeIndex":5},"prepare_c":{"family":"prepare","weapon":"any","type":"active","mp":10,"power":10,"chance":100,"gradeIndex":0},"prepare_b":{"family":"prepare","weapon":"any","type":"active","mp":20,"power":15,"chance":100,"gradeIndex":1},"prepare_a":{"family":"prepare","weapon":"any","type":"active","mp":35,"power":22,"chance":100,"gradeIndex":2},"prepare_s":{"family":"prepare","weapon":"any","type":"active","mp":55,"power":30,"chance":100,"gradeIndex":3},"prepare_sr":{"family":"prepare","weapon":"any","type":"active","mp":80,"power":40,"chance":100,"gradeIndex":4},"prepare_ssr":{"family":"prepare","weapon":"any","type":"active","mp":110,"power":50,"chance":100,"gradeIndex":5},"sword_mastery_c":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":3,"chance":100,"gradeIndex":0},"sword_mastery_b":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":5,"chance":100,"gradeIndex":1},"sword_mastery_a":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":7,"chance":100,"gradeIndex":2},"sword_mastery_s":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":9,"chance":100,"gradeIndex":3},"sword_mastery_sr":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":12,"chance":100,"gradeIndex":4},"sword_mastery_ssr":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":15,"chance":100,"gradeIndex":5},"bow_mastery_c":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":0,"chance":100,"gradeIndex":0},"bow_mastery_b":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":2,"chance":100,"gradeIndex":1},"bow_mastery_a":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":4,"chance":100,"gradeIndex":2},"bow_mastery_s":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":6,"chance":100,"gradeIndex":3},"bow_mastery_sr":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":9,"chance":100,"gradeIndex":4},"bow_mastery_ssr":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":12,"chance":100,"gradeIndex":5},"staff_mastery_c":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":3,"chance":100,"gradeIndex":0},"staff_mastery_b":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":5,"chance":100,"gradeIndex":1},"staff_mastery_a":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":7,"chance":100,"gradeIndex":2},"staff_mastery_s":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":9,"chance":100,"gradeIndex":3},"staff_mastery_sr":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":12,"chance":100,"gradeIndex":4},"staff_mastery_ssr":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":15,"chance":100,"gradeIndex":5},"return_oath_ssr":{"family":"return_oath","weapon":"any","type":"passive","mp":0,"power":15,"chance":100,"gradeIndex":5},"sixth_mark_ssr":{"family":"sixth_mark","weapon":"any","type":"passive","mp":0,"power":15,"chance":100,"gradeIndex":5}}$json$::jsonb)->p_id;
$spec$;
revoke all on function private.hunting_skill_spec(text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.refresh_hunting_state(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s private.hunting_states%rowtype;ticks integer;stamp timestamptz:=now();
begin
 insert into private.hunting_states(user_id) values(u) on conflict(user_id) do nothing;
 select * into s from private.hunting_states where user_id=u for update;
 ticks:=floor(greatest(0,extract(epoch from stamp-s.recovered_at))/300)::integer;
 s.vitality:=case when s.vitality>=100 then s.vitality else least(100,s.vitality+ticks) end;
 s.recovered_at:=case when s.vitality>=100 then greatest(stamp,s.recovered_at) else s.recovered_at+ticks*interval '300 seconds' end;
 update private.hunting_states set vitality=s.vitality,recovered_at=s.recovered_at where user_id=u;
 return jsonb_build_object('vitality',s.vitality,'recoveredAt',extract(epoch from s.recovered_at)*1000,'experience',s.experience,'mastery',s.mastery,'skills',to_jsonb(s.skills),'lastResult',s.last_result,'combatStats',private.combat_equipment_stats(u,(select jsonb_set(payload,'{expedition}',jsonb_build_object('equipment',payload->'equipped'),true) from public.game_saves where user_id=u)),'statAllocation',s.stat_allocation,'statResets',s.stat_resets,'statPoints',greatest(0,private.hunting_level(s.experience)-1-coalesce((s.stat_allocation->>'hp')::integer,0)-coalesce((s.stat_allocation->>'attack')::integer,0)-coalesce((s.stat_allocation->>'defense')::integer,0)-coalesce((s.stat_allocation->>'crit')::integer,0)-coalesce((s.stat_allocation->>'mp')::integer,0)),'currentHp',s.current_hp,'maxHp',s.max_hp,'currentMp',s.current_mp,'maxMp',100+10*coalesce((s.stat_allocation->>'mp')::integer,0),'potions',coalesce((select (l.products->>'potion')::bigint from private.village_life_players l where l.user_id=u),0),'foodTurns',coalesce((select l.food_turns from private.village_life_players l where l.user_id=u),'{}'::jsonb));
end $function$


CREATE OR REPLACE FUNCTION public.allocate_hunting_stats(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_allocation jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid; s public.game_saves%rowtype; h private.hunting_states%rowtype; k text; v jsonb;
 old_stats jsonb;new_stats jsonb;total integer:=0;old_total integer:=0;lvl integer;alloc jsonb:='{}'::jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 perform private.refresh_hunting_state(u);
 select * into h from private.hunting_states where user_id=u for update;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
 or jsonb_typeof(s.payload->'expedition') is distinct from 'null' then raise exception 'STAT_COMBAT_ACTIVE';end if;
 if p_allocation is null or jsonb_typeof(p_allocation)<>'object' then raise exception 'STAT_ALLOCATION_INVALID';end if;
 for k,v in select key,value from jsonb_each(p_allocation) loop
  if k not in ('hp','attack','defense','crit','mp') or jsonb_typeof(v)<>'number' or v::text !~ '^(0|[1-9][0-9]?)$' then raise exception 'STAT_ALLOCATION_INVALID';end if;
 end loop;
 for k in select unnest(array['hp','attack','defense','crit','mp']) loop
  if not p_allocation ? k and k<>'mp' then raise exception 'STAT_ALLOCATION_INVALID';end if;
  if coalesce((p_allocation->>k)::integer,0)<coalesce((h.stat_allocation->>k)::integer,0) then raise exception 'STAT_MUST_RESET';end if;
  total:=total+coalesce((p_allocation->>k)::integer,0);
  old_total:=old_total+coalesce((h.stat_allocation->>k)::integer,0);
 end loop;
 if (p_allocation->>'crit')::integer>10 then raise exception 'STAT_CRIT_LIMIT';end if;
 lvl:=private.hunting_level(h.experience);
 if total>lvl-1 then raise exception 'STAT_POINTS_EMPTY';end if;
 if total>old_total then
  old_stats:=private.combat_equipment_stats(u,jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true));
  update private.hunting_states set stat_allocation=p_allocation where user_id=u;
  new_stats:=private.combat_equipment_stats(u,jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true));
  update private.hunting_states set max_hp=(new_stats->>'hp')::numeric,
    current_hp=least((new_stats->>'hp')::numeric,coalesce(h.current_hp,(old_stats->>'hp')::numeric)+greatest(0,(new_stats->>'hp')::numeric-(old_stats->>'hp')::numeric))
   where user_id=u;
 end if;
 return jsonb_build_object('state',private.refresh_hunting_state(u),'record',private.cloud_record_json(u));
end $function$


CREATE OR REPLACE FUNCTION public.reset_hunting_stats(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;s public.game_saves%rowtype;h private.hunting_states%rowtype;
 charged bigint;old_stats jsonb;new_stats jsonb;oldhp numeric;newhp numeric;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 perform private.refresh_hunting_state(u);
 select * into h from private.hunting_states where user_id=u for update;
 select cost into charged from private.hunting_stat_reset_receipts where user_id=u and request_id=p_request_id;
 if found then return jsonb_build_object('state',private.refresh_hunting_state(u),'record',private.cloud_record_json(u),'cost',charged,'replayed',true);end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
 or jsonb_typeof(s.payload->'expedition') is distinct from 'null' then raise exception 'STAT_COMBAT_ACTIVE';end if;
 if coalesce((h.stat_allocation->>'hp')::integer,0)+coalesce((h.stat_allocation->>'attack')::integer,0)+coalesce((h.stat_allocation->>'defense')::integer,0)+coalesce((h.stat_allocation->>'crit')::integer,0)+coalesce((h.stat_allocation->>'mp')::integer,0)=0 then raise exception 'STAT_NOT_ALLOCATED';end if;
 charged:=case when h.stat_resets=0 then 0 else 10000+private.hunting_level(h.experience)*1000 end;
 if charged>0 then
  update private.player_wallets set silver=silver-charged,updated_at=now() where user_id=u and silver>=charged;
  if not found then raise exception 'STAT_SILVER_SHORTAGE';end if;
 end if;
 old_stats:=private.combat_equipment_stats(u,jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true));
 update private.hunting_states set stat_allocation='{"hp":0,"attack":0,"defense":0,"crit":0,"mp":0}'::jsonb,stat_resets=stat_resets+1 where user_id=u;
 new_stats:=private.combat_equipment_stats(u,jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true));
 oldhp:=(old_stats->>'hp')::numeric;newhp:=(new_stats->>'hp')::numeric;
 update private.hunting_states set max_hp=newhp,current_hp=least(newhp,greatest(1,coalesce(h.current_hp,oldhp))) where user_id=u;
 insert into private.hunting_stat_reset_receipts(user_id,request_id,cost) values(u,p_request_id,charged);
 if charged>0 then perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');end if;
 return jsonb_build_object('state',private.refresh_hunting_state(u),'record',private.cloud_record_json(u),'cost',charged,'replayed',false);
end $function$


CREATE OR REPLACE FUNCTION public.save_hunting_preset(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_skills text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid; chosen text; spec jsonb; active_count integer:=0;passive_count integer:=0; weapon text;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);

 if p_skills is null or cardinality(p_skills)>9
 or (select count(distinct x) from unnest(p_skills)x)<>cardinality(p_skills)
 or exists(select 1 from unnest(p_skills)x where x is null)
 then raise exception 'HUNT_PRESET_INVALID';end if;
 weapon:=coalesce((private.combat_equipment_stats(u,jsonb_set((select payload from public.game_saves where user_id=u),'{expedition}',jsonb_build_object('equipment',(select payload->'equipped' from public.game_saves where user_id=u)),true))->>'weapon'),'sword');
 foreach chosen in array p_skills loop
  if chosen in ('heavy','guard','quick') then active_count:=active_count+1;continue;end if;
  spec:=private.hunting_skill_spec(chosen);
  if spec is null or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=chosen)
     or spec->>'weapon' not in ('any',weapon) then raise exception 'HUNT_PRESET_INVALID';end if;
  if spec->>'type'='active' then active_count:=active_count+1;else passive_count:=passive_count+1;end if;
 end loop;
 if active_count>6 or passive_count>3 then raise exception 'HUNT_PRESET_INVALID';end if;
 perform private.refresh_hunting_state(u);
 update private.hunting_states set skills=p_skills where user_id=u;
 return private.refresh_hunting_state(u)||jsonb_build_object('serverNow',extract(epoch from now())*1000);
end $function$


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
 reward_silver bigint;xp bigint;material text;monster_name text;stamp bigint:=floor(extract(epoch from now())*1000);
 mp_now numeric;mp_max numeric;spec jsonb;family text;weapon text;enhance_level integer;
 skill_power numeric;chance numeric;penetration numeric;bonus numeric;heal_amount numeric;
 shield_pts numeric:=0;shield_until integer:=0;oath_available boolean:=false;
 passive_bonus numeric:=0;sixth_mark boolean:=false;active_count integer:=0;
 prep_bonus numeric:=0;prep_until integer:=0;dot_pct numeric:=0;monster_dot numeric:=0;monster_dot_until integer:=0;
 monster_def_down numeric:=0;monster_def_until integer:=0;incoming numeric;absorbed numeric;
 grade_index integer;cd_interval integer;
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
   player:=jsonb_set(player,'{hp}',to_jsonb(round((player->>'hp')::numeric*(1+bonus))),true);oath_available:=true;
  elsif spec->>'family'='sixth_mark' then sixth_mark:=true;
  elsif spec->>'family' in ('sword_mastery','bow_mastery','staff_mastery') then passive_bonus:=passive_bonus+bonus;
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
   if random()*100 >= (spec->>'chance')::numeric then
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
    hit:=private.hunting_damage(attack*(case when coalesce((effects->>'attack_downUntil')::integer,0)>=turn_no
     then 1-coalesce((effects->>'attack_down')::numeric,0) else 1 end),
     md*(1-case when monster_def_until>=turn_no then monster_def_down else 0 end),mult,penetration);
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
    if family='staff_rift' then monster_def_down:=least(.9,skill_power/100);monster_def_until:=turn_no+2;end if;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||
     '! '||hit::text||' 피해'||case when critical then ' · 치명타' else '' end);
   end if;
   if sixth_mark and active_count%6=0 then
    mp_now:=least(mp_max,mp_now+80);prep_bonus:=greatest(prep_bonus,.15);prep_until:=turn_no+2;
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
    shield_pts:=greatest(shield_pts,floor((player->>'hp')::numeric*.15));shield_until:=turn_no+2;
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
 result:=jsonb_build_object('monster',monster,'equipment',drop_item,'requestId',p_request_id,'mapId',p_map_id,'outcome',case when win then 'victory' else 'defeat' end,'player',player,'playerHp',hp,'playerMp',mp_now,'playerMaxMp',mp_max,'startHp',start_hp,'recoveredHp',next_hp,'potionsUsed',potions_used,'monsterHp',mhp,'turns',turns,'silver',case when win then reward_silver else 0 end,'exp',case when win then xp else 0 end,'mastery',case when win then 1 else 0 end,'materialCount',case when win then 1 else 0 end,'createdAt',stamp);
 if win then
  if drop_item is not null then insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||(drop_item->>'id'),1,drop_item);end if;
  update private.player_wallets set silver=private.player_wallets.silver+reward_silver,updated_at=now() where user_id=u;
  insert into private.market_assets(user_id,item_id,quantity) values(u,material,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1,updated_at=now();
 end if;
 update private.hunting_states set current_hp=next_hp,max_hp=(player->>'hp')::numeric,current_mp=mp_now,vitality=vitality-1,experience=experience+case when win then xp else 0 end,mastery=mastery+case when win then 1 else 0 end,last_result=result where user_id=u;
 insert into private.hunting_receipts(user_id,request_id,map_id,result) values(u,p_request_id,p_map_id,result);
 perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');
 return jsonb_build_object('state',private.refresh_hunting_state(u),'result',result,'record',private.cloud_record_json(u),'replayed',false,'serverNow',stamp);
end $function$

