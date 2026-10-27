-- Shared server-owned vitality for hunting, gathering, farming, and crafting.
-- Preserve natural regeneration of 1 per five minutes, cap 100, and potion overcap.
-- action_points remains deprecated for compatibility and is never spent.
CREATE OR REPLACE FUNCTION private.refresh_village_life(u uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare today date;
begin
 insert into private.village_life_players(user_id) values(u) on conflict(user_id) do nothing;
 perform 1 from private.village_life_players where user_id=u for update;
 today:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 update private.village_life_players set day=today where user_id=u and day<today;
end $function$;

CREATE OR REPLACE FUNCTION private.village_life_snapshot(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;s private.village_life_players%rowtype;towns jsonb;vh private.hunting_states%rowtype;life_vitality integer;life_recovered timestamptz;life_ticks integer;
begin
 select * into strict s from private.village_life_players where user_id=u;
 -- Read shared vitality without reversing the hunting-to-life row lock order.
 select * into vh from private.hunting_states where user_id=u;
 if found then
  life_ticks:=floor(greatest(0,extract(epoch from clock_timestamp()-vh.recovered_at))/300)::integer;
  life_vitality:=case when vh.vitality>=100 then vh.vitality else least(100,vh.vitality+life_ticks) end;
  life_recovered:=case when life_vitality>=100 then greatest(clock_timestamp(),vh.recovered_at) else vh.recovered_at+life_ticks*interval '300 seconds' end;
 else life_vitality:=100;life_recovered:=clock_timestamp();end if;
 select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'kind',t.kind,'x',t.x,'y',t.y,'owner',coalesce(g.name,'중립'),'tax',case when g.association_id is null then 0 when ts.owner_association_id=ow.association_id then ts.tax_rate else 10 end,
 'herbCapacity',t.herb_capacity,'farmCapacity',t.farm_capacity,
 'herbRemaining',case when t.day<today then t.herb_capacity else t.herb_remaining end,
 'farmRemaining',case when t.day<today then t.farm_capacity else t.farm_remaining end) order by t.y,t.x) into towns from private.village_life_towns t
  left join private.village_war_owners ow on ow.town_id=t.id
  left join private.online_associations g on g.association_id=ow.association_id and g.status='ACTIVE'
  left join private.guild_village_tax ts on ts.town_id=t.id;
 return jsonb_build_object('location',s.location,'vitality',life_vitality,'recoveredAt',extract(epoch from life_recovered)*1000,'actionPoints',life_vitality,'materials',s.materials||jsonb_build_object('stone',coalesce((s.materials->>'stone')::bigint,0)), 'products',s.products,'craftMastery',s.craft_mastery,'lifeMasteries',s.life_masteries,'craftCarry',s.craft_carry,'foodTurns',s.food_turns,'wellReadyAt',coalesce(extract(epoch from s.well_ready_at)*1000,0),'health',(select jsonb_build_object('hp',h.current_hp,'maxHp',h.max_hp) from private.hunting_states h where h.user_id=u),'towns',towns,
 'serverNow',extract(epoch from clock_timestamp())*1000,'nextResetAt',extract(epoch from ((today+1)::timestamp at time zone 'Asia/Seoul'))*1000);
end $function$;

CREATE OR REPLACE FUNCTION public.gather_village(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_town_id text, p_resource text, p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;s private.village_life_players%rowtype;t private.village_life_towns%rowtype;r private.village_life_receipts%rowtype;
 today date;gains jsonb:='{}';net_gains jsonb:='{}';tax_gains jsonb:='{}';
  m jsonb;item text;i integer;total integer;result jsonb;
  tax_guild uuid;tax_rate integer:=0;gross_count bigint;tax_count bigint;balance bigint;tax_units bigint;carry_value integer;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 if p_count is null or p_count<1 or p_count>100 then raise exception 'COUNT_INVALID';end if;
 if p_resource is null or p_resource not in ('herb','farm') then raise exception 'RESOURCE_INVALID';end if;
 -- Lock hunting vitality before village state, as in hunt_once.
 perform private.refresh_hunting_state(u);
 perform private.refresh_village_life(u);
 select * into strict s from private.village_life_players where user_id=u;
 select * into r from private.village_life_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.town_id is distinct from p_town_id or r.resource<>p_resource or r.count<>p_count then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.village_life_snapshot(u),'result',r.result,'replayed',true);
 end if;
 if s.location is distinct from p_town_id then raise exception 'LOCATION_MISMATCH';end if;
 select * into t from private.village_life_towns where id=p_town_id for update;
 if not found then raise exception 'TOWN_INVALID';end if;
 if t.kind<>p_resource and t.kind<>'city' then raise exception 'RESOURCE_INVALID';end if;
 today:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 if t.day<today then t.herb_remaining:=t.herb_capacity;t.farm_remaining:=t.farm_capacity;t.day:=today;end if;
 -- Re-evaluate the player date after waiting for shared town stock across midnight.
 if s.day<today then s.day:=today;end if;
 if (select vitality from private.hunting_states where user_id=u)<p_count then raise exception 'VITALITY_EMPTY';end if;
 total:=p_count*10;
 if (p_resource='herb' and t.herb_remaining<total) or (p_resource='farm' and t.farm_remaining<total) then raise exception 'TOWN_STOCK_EMPTY';end if;
 m:=s.materials;
 for i in 1..p_count loop
  item:=case when p_resource='herb' then 'herb' else (array['pepper','potato','wheat'])[floor(random()*3)::integer+1] end;
  gains:=jsonb_set(gains,array[item],to_jsonb(coalesce((gains->>item)::bigint,0)+10),true);
  m:=jsonb_set(m,array[item],to_jsonb(coalesce((m->>item)::bigint,0)+10),true);
 end loop;
 -- The town row is locked above. Tax changes also lock that town.
 select w.association_id,
   case when tx.owner_association_id=w.association_id then tx.tax_rate else 10 end
 into tax_guild,tax_rate
 from private.village_war_owners w
 join private.online_associations a on a.association_id=w.association_id and a.status='ACTIVE'
 left join private.guild_village_tax tx on tx.town_id=w.town_id
 where w.town_id=p_town_id;
 if tax_guild is null then tax_rate:=0;end if;
 for item,gross_count in select key,value::bigint from jsonb_each_text(gains) loop
  if tax_guild is not null then
   select remainder into carry_value from private.guild_material_tax_carry
   where user_id=u and town_id=p_town_id and association_id=tax_guild and material=item for update;
   tax_units:=gross_count*tax_rate+coalesce(carry_value,0);
   tax_count:=tax_units/100;
   insert into private.guild_material_tax_carry(user_id,town_id,association_id,material,remainder)
   values(u,p_town_id,tax_guild,item,mod(tax_units,100)::integer)
   on conflict(user_id,town_id,association_id,material) do update set remainder=excluded.remainder;
  else tax_count:=0;end if;
  net_gains:=jsonb_set(net_gains,array[item],to_jsonb(gross_count-tax_count),true);
  if tax_count>0 then
   m:=jsonb_set(m,array[item],to_jsonb(coalesce((m->>item)::bigint,0)-tax_count),true);
   tax_gains:=jsonb_set(tax_gains,array[item],to_jsonb(tax_count),true);
   insert into private.guild_material_stock(association_id,material,quantity)
   values(tax_guild,item,tax_count)
   on conflict(association_id,material) do update set quantity=private.guild_material_stock.quantity+excluded.quantity
   returning quantity into balance;
   insert into private.guild_material_ledger(association_id,actor_user_id,operation,material,amount,balance_after,town_id,detail)
   values(tax_guild,u,'GATHER_TAX',item,tax_count,balance,p_town_id,'마을 채집 세금 '||tax_rate||'%');
  end if;
 end loop;
 update private.hunting_states set vitality=vitality-p_count where user_id=u;
 update private.village_life_players set materials=m,day=s.day,
 life_masteries=jsonb_set(s.life_masteries,array[case when p_resource='herb' then 'herb' else 'farm' end],
 to_jsonb(least(3200,coalesce((s.life_masteries->>(case when p_resource='herb' then 'herb' else 'farm' end))::bigint,0)+p_count)),true)
 where user_id=u;
 update private.village_life_towns set day=t.day,herb_remaining=t.herb_remaining-case when p_resource='herb' then total else 0 end,
 farm_remaining=t.farm_remaining-case when p_resource='farm' then total else 0 end where id=p_town_id;
 result:=jsonb_build_object('townId',p_town_id,'resource',p_resource,'count',p_count,'vitalitySpent',p_count,'actionPointsSpent',p_count,'gains',net_gains,'tax',tax_gains,'taxRate',tax_rate);
 insert into private.village_life_receipts(user_id,request_id,town_id,resource,count,result) values(u,p_request_id,p_town_id,p_resource,p_count,result);
 return jsonb_build_object('state',private.village_life_snapshot(u),'result',result,'replayed',false);
end $function$;

CREATE OR REPLACE FUNCTION public.village_life_action(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_town_id text, p_action text, p_item text, p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;s private.village_life_players%rowtype;r private.village_life_action_receipts%rowtype;
 kind text;material text;mastery_kind text;base integer;quantity bigint:=0;carry integer;bonus integer;i integer;result jsonb;stamp timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 if p_count is null or p_count<1 or p_count>100 then raise exception 'COUNT_INVALID';end if;
 if p_action is null or p_action not in ('craft','food','well') then raise exception 'RECIPE_INVALID';end if;
 -- Well takes hunting before life, matching hunt_once's save->wallet->hunting->life order.
 perform private.refresh_hunting_state(u);
 perform private.refresh_village_life(u);
 select * into strict s from private.village_life_players where user_id=u;
 select * into r from private.village_life_action_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.town_id is distinct from p_town_id or r.action<>p_action or r.item is distinct from p_item or r.count<>p_count then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.village_life_snapshot(u),'result',r.result,'replayed',true);
 end if;
 if s.location is distinct from p_town_id then raise exception 'LOCATION_MISMATCH';end if;
 if p_action='craft' then
  mastery_kind:=case when p_item='potion' then 'herb' when p_item='challenge_ticket' then 'ticket' else 'farm' end;
  if p_item is null or p_item not in ('potion','attack_food','defense_food','experience_food','challenge_ticket') then raise exception 'RECIPE_INVALID';end if;
  select t.kind into kind from private.village_life_towns t where t.id=s.location;
  if kind<>'city' and kind<>(case when p_item='potion' then 'herb' when p_item='challenge_ticket' then 'city' else 'farm' end) then raise exception 'RECIPE_LOCATION';end if;
  if (select vitality from private.hunting_states where user_id=u)<p_count then raise exception 'VITALITY_EMPTY';end if;
  material:=case p_item when 'potion' then 'herb' when 'attack_food' then 'pepper' when 'defense_food' then 'potato' when 'experience_food' then 'wheat' else 'stone' end;
  if coalesce((s.materials->>material)::bigint,0)<p_count*10 then raise exception 'MATERIALS_EMPTY';end if;
  base:=case when p_item='potion' then 1000 else 1 end;
  carry:=coalesce((s.craft_carry->>p_item)::integer,0);
  for i in 1..p_count loop
   bonus:=private.life_mastery_bonus(coalesce((s.life_masteries->>mastery_kind)::bigint,0));
   carry:=carry+base*bonus;quantity:=quantity+base+carry/100;carry:=carry%100;
   s.craft_mastery:=s.craft_mastery+1;
   s.life_masteries:=jsonb_set(s.life_masteries,array[mastery_kind],
     to_jsonb(least(3200,coalesce((s.life_masteries->>mastery_kind)::bigint,0)+1)),true);
  end loop;
  s.craft_carry:=jsonb_set(s.craft_carry,array[p_item],to_jsonb(carry),true);
  s.materials:=jsonb_set(s.materials,array[material],to_jsonb((s.materials->>material)::bigint-p_count*10),true);
  s.products:=jsonb_set(s.products,array[p_item],to_jsonb(coalesce((s.products->>p_item)::bigint,0)+quantity),true);
  update private.hunting_states set vitality=vitality-p_count where user_id=u;
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
 update private.village_life_players set materials=s.materials,products=s.products,
 craft_mastery=s.craft_mastery,life_masteries=s.life_masteries,craft_carry=s.craft_carry,food_turns=s.food_turns,well_ready_at=s.well_ready_at where user_id=u;
 result:=jsonb_build_object('action',p_action,'item',p_item,'count',p_count,'quantity',quantity,'vitalitySpent',case when p_action='craft' then p_count else 0 end,'actionPointsSpent',case when p_action='craft' then p_count else 0 end);
 insert into private.village_life_action_receipts(user_id,request_id,town_id,action,item,count,result) values(u,p_request_id,p_town_id,p_action,p_item,p_count,result);
 return jsonb_build_object('state',private.village_life_snapshot(u),'result',result,'replayed',false);
end $function$;
