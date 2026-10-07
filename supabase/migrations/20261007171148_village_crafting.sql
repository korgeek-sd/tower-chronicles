-- Life products and mastery are independent of client saves and legacy potions.
alter table private.village_life_players
 add column products jsonb not null default '{"potion":0,"attack_food":0,"defense_food":0,"experience_food":0,"challenge_ticket":0}',
 add column craft_mastery bigint not null default 0 check(craft_mastery>=0),
 add column craft_carry jsonb not null default '{}',
 add column food_turns jsonb not null default '{"attack_food":0,"defense_food":0,"experience_food":0}',
 add column well_ready_at timestamptz;
alter table private.hunting_states add column current_hp numeric check(current_hp>=1),add column max_hp numeric check(max_hp>=1);
create table private.village_life_action_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,town_id text not null,
 action text not null,item text not null,count integer not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table private.village_life_action_receipts enable row level security;
revoke all on private.village_life_action_receipts from public,anon,authenticated;
create or replace function private.village_life_snapshot(u uuid) returns jsonb language plpgsql set search_path='' as $$
declare today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;s private.village_life_players%rowtype;towns jsonb;
begin
 select * into strict s from private.village_life_players where user_id=u;
 select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'kind',t.kind,'x',t.x,'y',t.y,'owner','중립','tax',0,
 'herbCapacity',t.herb_capacity,'farmCapacity',t.farm_capacity,
 'herbRemaining',case when t.day<today then t.herb_capacity else t.herb_remaining end,
 'farmRemaining',case when t.day<today then t.farm_capacity else t.farm_remaining end) order by t.y,t.x) into towns from private.village_life_towns t;
 return jsonb_build_object('location',s.location,'actionPoints',case when s.day<today then 100 else s.action_points end,'materials',s.materials||jsonb_build_object('stone',coalesce((s.materials->>'stone')::bigint,0)), 'products',s.products,'craftMastery',s.craft_mastery,'craftCarry',s.craft_carry,'foodTurns',s.food_turns,'wellReadyAt',coalesce(extract(epoch from s.well_ready_at)*1000,0),'health',(select jsonb_build_object('hp',h.current_hp,'maxHp',h.max_hp) from private.hunting_states h where h.user_id=u),'towns',towns,
 'serverNow',extract(epoch from clock_timestamp())*1000,'nextResetAt',extract(epoch from ((today+1)::timestamp at time zone 'Asia/Seoul'))*1000);
end $$;

create function public.village_life_action(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_town_id text,p_action text,p_item text,p_count integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;s private.village_life_players%rowtype;r private.village_life_action_receipts%rowtype;
 kind text;material text;base integer;quantity bigint:=0;carry integer;bonus integer;i integer;result jsonb;stamp timestamptz;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 if p_count is null or p_count<1 or p_count>100 then raise exception 'COUNT_INVALID';end if;
 if p_action is null or p_action not in ('craft','food','well') then raise exception 'RECIPE_INVALID';end if;
 -- Well takes hunting before life, matching hunt_once's save->wallet->hunting->life order.
 if p_action='well' then perform private.refresh_hunting_state(u);end if;
 perform private.refresh_village_life(u);
 select * into strict s from private.village_life_players where user_id=u;
 select * into r from private.village_life_action_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.town_id is distinct from p_town_id or r.action<>p_action or r.item is distinct from p_item or r.count<>p_count then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.village_life_snapshot(u),'result',r.result,'replayed',true);
 end if;
 if s.location is distinct from p_town_id then raise exception 'LOCATION_MISMATCH';end if;
 if p_action='craft' then
  if p_item is null or p_item not in ('potion','attack_food','defense_food','experience_food','challenge_ticket') then raise exception 'RECIPE_INVALID';end if;
  select t.kind into kind from private.village_life_towns t where t.id=s.location;
  if kind<>'city' and kind<>(case when p_item='potion' then 'herb' when p_item='challenge_ticket' then 'city' else 'farm' end) then raise exception 'RECIPE_LOCATION';end if;
  if s.action_points<p_count then raise exception 'ACTION_POINTS_EMPTY';end if;
  material:=case p_item when 'potion' then 'herb' when 'attack_food' then 'pepper' when 'defense_food' then 'potato' when 'experience_food' then 'wheat' else 'stone' end;
  if coalesce((s.materials->>material)::bigint,0)<p_count*10 then raise exception 'MATERIALS_EMPTY';end if;
  base:=case when p_item='potion' then 1000 else 1 end;
  carry:=coalesce((s.craft_carry->>p_item)::integer,0);
  for i in 1..p_count loop
   bonus:=least(50,s.craft_mastery/100);carry:=carry+base*bonus;quantity:=quantity+base+carry/100;carry:=carry%100;s.craft_mastery:=s.craft_mastery+1;
  end loop;
  s.craft_carry:=jsonb_set(s.craft_carry,array[p_item],to_jsonb(carry),true);
  s.materials:=jsonb_set(s.materials,array[material],to_jsonb((s.materials->>material)::bigint-p_count*10),true);
  s.products:=jsonb_set(s.products,array[p_item],to_jsonb(coalesce((s.products->>p_item)::bigint,0)+quantity),true);
  s.action_points:=s.action_points-p_count;
 elsif p_action='food' then
  if p_item is null or p_item not in ('attack_food','defense_food','experience_food') then raise exception 'RECIPE_INVALID';end if;
  if coalesce((s.products->>p_item)::bigint,0)<p_count then raise exception 'PRODUCTS_EMPTY';end if;
  s.products:=jsonb_set(s.products,array[p_item],to_jsonb((s.products->>p_item)::bigint-p_count),true);
  s.food_turns:=jsonb_set(s.food_turns,array[p_item],to_jsonb(coalesce((s.food_turns->>p_item)::bigint,0)+p_count*30),true);
  quantity:=p_count;
 else
  if p_item is distinct from 'well' or p_count<>1 then raise exception 'RECIPE_INVALID';end if;
  stamp:=clock_timestamp();
  if s.well_ready_at>stamp then raise exception 'WELL_COOLDOWN';end if;
  s.well_ready_at:=stamp+interval '30 seconds';
  -- NULL means fully recovered to the next battle's authoritative equipment HP.
  update private.hunting_states set current_hp=null where user_id=u;
 end if;
 update private.village_life_players set materials=s.materials,products=s.products,action_points=s.action_points,
 craft_mastery=s.craft_mastery,craft_carry=s.craft_carry,food_turns=s.food_turns,well_ready_at=s.well_ready_at where user_id=u;
 result:=jsonb_build_object('action',p_action,'item',p_item,'count',p_count,'quantity',quantity,'actionPointsSpent',case when p_action='craft' then p_count else 0 end);
 insert into private.village_life_action_receipts(user_id,request_id,town_id,action,item,count,result) values(u,p_request_id,p_town_id,p_action,p_item,p_count,result);
 return jsonb_build_object('state',private.village_life_snapshot(u),'result',result,'replayed',false);
end $$;
revoke all on function public.village_life_action(uuid,bigint,text,text,uuid,text,text,text,integer) from public,anon;
grant execute on function public.village_life_action(uuid,bigint,text,text,uuid,text,text,text,integer) to authenticated;
create or replace function private.refresh_hunting_state(u uuid) returns jsonb language plpgsql set search_path='' as $$
declare s private.hunting_states%rowtype;ticks integer;stamp timestamptz:=now();
begin
 insert into private.hunting_states(user_id) values(u) on conflict(user_id) do nothing;
 select * into s from private.hunting_states where user_id=u for update;
 ticks:=floor(greatest(0,extract(epoch from stamp-s.recovered_at))/300)::integer;
 s.vitality:=least(100,s.vitality+ticks);
 s.recovered_at:=case when s.vitality=100 then greatest(stamp,s.recovered_at) else s.recovered_at+ticks*interval '300 seconds' end;
 update private.hunting_states set vitality=s.vitality,recovered_at=s.recovered_at where user_id=u;
 return jsonb_build_object('vitality',s.vitality,'recoveredAt',extract(epoch from s.recovered_at)*1000,'experience',s.experience,'mastery',s.mastery,'skills',to_jsonb(s.skills),'lastResult',s.last_result,'currentHp',s.current_hp,'maxHp',s.max_hp,'potions',coalesce((select (l.products->>'potion')::bigint from private.village_life_players l where l.user_id=u),0),'foodTurns',coalesce((select l.food_turns from private.village_life_players l where l.user_id=u),'{}'::jsonb));
end $$;
create or replace function public.hunt_once(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_map_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid;l private.village_life_players%rowtype;potions_used bigint;next_hp numeric;start_hp numeric;food text;remaining bigint;s public.game_saves%rowtype;h private.hunting_states%rowtype;r private.hunting_receipts%rowtype;
 p jsonb;player jsonb;result jsonb;turns jsonb:='[]';lines jsonb;cd jsonb:='{}';skill text;candidate text;
 mh numeric;mhp numeric;hp numeric;attack numeric;defense numeric;ma numeric;md numeric;hit numeric;mult numeric;guard boolean;critical boolean;win boolean;turn_no integer;
 reward_silver bigint;xp bigint;material text;monster_name text;stamp bigint:=floor(extract(epoch from now())*1000);
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'HUNT_REQUEST_REQUIRED';end if;
 if p_map_id is null or p_map_id not in ('plains','forest','mine') then raise exception 'HUNT_MAP_INVALID';end if;
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
 if p_map_id='plains' then mh:=90;ma:=12;md:=5;reward_silver:=35;xp:=20;material:='material:leather:1';monster_name:='가죽 갉는 하이에나';
 elsif p_map_id='forest' then mh:=130;ma:=18;md:=8;reward_silver:=55;xp:=30;material:='material:leather:1';monster_name:='가시 자칼';
 else mh:=180;ma:=24;md:=14;reward_silver:=80;xp:=45;material:='material:ore:1';monster_name:='고블린 광부';end if;
 -- Resolve equipment using the canonical inventory and no job multipliers.
 p:=jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true);
 player:=private.combat_equipment_stats(u,p);
 hp:=greatest(1,least((player->>'hp')::numeric,coalesce(h.current_hp,(player->>'hp')::numeric)));start_hp:=hp;
 attack:=(player->>'attack')::numeric*case when coalesce((l.food_turns->>'attack_food')::bigint,0)>0 then 1.1 else 1 end;
 defense:=(player->>'defense')::numeric*case when coalesce((l.food_turns->>'defense_food')::bigint,0)>0 then 1.1 else 1 end;
 player:=player||jsonb_build_object('attack',attack,'defense',defense);
 if coalesce((l.food_turns->>'experience_food')::bigint,0)>0 then xp:=floor(xp*1.1);end if;
 mhp:=mh;
 for turn_no in 1..100 loop
  exit when hp<=0 or mhp<=0;
  lines:='[]';skill:=null;guard:=false;
  foreach candidate in array h.skills loop
   if coalesce((cd->>candidate)::integer,0)<=turn_no and (candidate<>'guard' or hp/(player->>'hp')::numeric<=.5) then skill:=candidate;exit;end if;
  end loop;
  if skill='guard' then
   guard:=true;cd:=cd||jsonb_build_object('guard',turn_no+4);lines:=lines||jsonb_build_array('탐사자의 방어! 이번 턴 피해 50% 감소');
  else
   mult:=case skill when 'heavy' then 1.8 when 'quick' then 1.2 else 1 end;
   critical:=random()<coalesce((player->>'critChance')::numeric,.05);
   hit:=greatest(1,floor(attack*mult*(case when critical then 1.5 else 1 end)*100/(100+greatest(0,md))));
   mhp:=greatest(0,mhp-hit);
   if skill is not null then cd:=cd||jsonb_build_object(skill,turn_no+case when skill='heavy' then 3 else 2 end);end if;
   lines:=lines||jsonb_build_array('탐사자의 '||case skill when 'heavy' then '강타' when 'quick' then '속공' else '공격' end||'! '||hit::text||' 피해'||case when critical then ' · 치명타' else '' end);
  end if;
  if mhp>0 then hit:=greatest(1,floor(ma*(case when guard then .5 else 1 end)*100/(100+greatest(0,defense))));hp:=greatest(0,hp-hit);lines:=lines||jsonb_build_array(monster_name||'의 공격! '||hit::text||' 피해');end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp));
 end loop;
 win:=mhp=0 and hp>0;
 potions_used:=least(coalesce((l.products->>'potion')::bigint,0),ceil(greatest(0,(player->>'hp')::numeric-hp))::bigint);
 next_hp:=greatest(1,least((player->>'hp')::numeric,hp+potions_used));
 l.products:=jsonb_set(l.products,'{potion}',to_jsonb(coalesce((l.products->>'potion')::bigint,0)-potions_used),true);
 foreach food in array array['attack_food','defense_food','experience_food'] loop
  remaining:=coalesce((l.food_turns->>food)::bigint,0);l.food_turns:=jsonb_set(l.food_turns,array[food],to_jsonb(greatest(0,remaining-1)),true);
 end loop;
 update private.village_life_players set products=l.products,food_turns=l.food_turns where user_id=u;
 result:=jsonb_build_object('requestId',p_request_id,'mapId',p_map_id,'outcome',case when win then 'victory' else 'defeat' end,'player',player||jsonb_build_object('speed',10),'playerHp',hp,'startHp',start_hp,'recoveredHp',next_hp,'potionsUsed',potions_used,'monsterHp',mhp,'turns',turns,'silver',case when win then reward_silver else 0 end,'exp',case when win then xp else 0 end,'mastery',case when win then 1 else 0 end,'materialCount',case when win then 1 else 0 end,'createdAt',stamp);
 if win then
  update private.player_wallets set silver=private.player_wallets.silver+reward_silver,updated_at=now() where user_id=u;
  insert into private.market_assets(user_id,item_id,quantity) values(u,material,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1,updated_at=now();
 end if;
 update private.hunting_states set current_hp=next_hp,max_hp=(player->>'hp')::numeric,vitality=vitality-1,experience=experience+case when win then xp else 0 end,mastery=mastery+case when win then 1 else 0 end,last_result=result where user_id=u;
 insert into private.hunting_receipts(user_id,request_id,map_id,result) values(u,p_request_id,p_map_id,result);
 perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');
 return jsonb_build_object('state',private.refresh_hunting_state(u),'result',result,'record',private.cloud_record_json(u),'replayed',false,'serverNow',stamp);
end $$;
-- v0.1.64: universal enhancement stones and server-authoritative equipment dismantling.

create or replace function public.dismantle_online_equipment(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_item_id text
) returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_asset private.market_assets%rowtype;
  v_grade text;
  v_yield bigint;v_split bigint;
begin
  v_user:=private.village_life_user(
    p_lease_id,p_generation,p_client_instance_id,p_device_id
  );

  if nullif(p_item_id,'') is null then
    raise exception 'DISMANTLE_ITEM_NOT_FOUND';
  end if;
  if p_item_id='starter-v2' then
    raise exception 'DISMANTLE_STARTER_PROTECTED';
  end if;

  select * into v_save
  from public.game_saves
  where user_id=v_user
  for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;

  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null'
     or exists(
       select 1
       from private.online_expeditions e
       where e.user_id=v_user and e.status='ACTIVE'
     ) then
    raise exception 'DISMANTLE_EXPEDITION_BLOCKED';
  end if;

  if exists(
    select 1
    from jsonb_each_text(coalesce(v_save.payload->'equipped','{}'::jsonb)) equipped
    where equipped.value=p_item_id
  ) then
    raise exception 'DISMANTLE_EQUIPPED';
  end if;

  select * into v_asset
  from private.market_assets
  where user_id=v_user
    and item_id='equipment_v2:'||p_item_id
    and quantity=1
    and gear is not null
  for update;
  if not found then raise exception 'DISMANTLE_ITEM_NOT_FOUND';end if;

  v_grade:=v_asset.gear->>'grade';
  v_yield:=case v_grade
    when 'common' then 1
    when 'uncommon' then 2
    when 'rare' then 4
    when 'heroic' then 8
    when 'legendary' then 15
    else 0
  end;
  if v_yield<=0 then raise exception 'DISMANTLE_GRADE_INVALID';end if;

  delete from private.market_assets
  where user_id=v_user
    and item_id='equipment_v2:'||p_item_id;

  insert into private.market_assets(user_id,item_id,quantity,updated_at)
  values(v_user,'other:enhancement_stone',v_yield,now())
  on conflict(user_id,item_id) do update
  set quantity=private.market_assets.quantity+excluded.quantity,
      updated_at=now();

  perform private.refresh_village_life(v_user);
  v_split:=case coalesce((v_asset.gear->>'tier')::integer,1) when 1 then 1 when 2 then 3 when 3 then 6 when 4 then 10 else 15 end;
  update private.village_life_players set materials=jsonb_set(materials,'{stone}',to_jsonb(coalesce((materials->>'stone')::bigint,0)+v_split),true) where user_id=v_user;
  perform private.persist_market_economy_to_save(v_user);

  return jsonb_build_object(
    'itemId',p_item_id,
    'stones',v_yield,'splitStones',v_split,
    'record',private.cloud_record_json(v_user)
  );
end;$$;

revoke all on function public.dismantle_online_equipment(uuid,bigint,text,text,text)
from public,anon;
grant execute on function public.dismantle_online_equipment(uuid,bigint,text,text,text)
to authenticated;

create or replace function public.get_hunting_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.refresh_hunting_state(u)||jsonb_build_object('serverNow',extract(epoch from now())*1000);
end $$;
revoke all on function public.get_hunting_state(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_hunting_state(uuid,bigint,text,text) to authenticated;

create or replace function public.save_hunting_preset(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_skills text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_skills is null or cardinality(p_skills)>3 or exists(select 1 from unnest(p_skills) x where x is null or x not in ('heavy','guard','quick')) or (select count(distinct x) from unnest(p_skills)x)<>cardinality(p_skills) then raise exception 'HUNT_PRESET_INVALID';end if;
 perform private.refresh_hunting_state(u);
 update private.hunting_states set skills=p_skills where user_id=u;
 return private.refresh_hunting_state(u)||jsonb_build_object('serverNow',extract(epoch from now())*1000);
end $$;
revoke all on function public.save_hunting_preset(uuid,bigint,text,text,text[]) from public,anon;
grant execute on function public.save_hunting_preset(uuid,bigint,text,text,text[]) to authenticated;

