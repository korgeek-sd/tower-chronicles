-- Retain fractional material taxes per player/town/guild/item so 1–9% cannot be evaded by single-action harvesting.
create table private.guild_material_tax_carry(
 user_id uuid not null references auth.users(id) on delete cascade,
 town_id text not null references private.village_life_towns(id),
 association_id uuid not null references private.online_associations(association_id) on delete cascade,
 material text not null check(material in('herb','pepper','potato','wheat')),
 remainder integer not null default 0 check(remainder between 0 and 99),
 primary key(user_id,town_id,association_id,material)
);
alter table private.guild_material_tax_carry enable row level security;
revoke all on private.guild_material_tax_carry from public,anon,authenticated;
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
 if s.day<today then s.action_points:=100;s.day:=today;end if;
 if s.action_points<p_count then raise exception 'ACTION_POINTS_EMPTY';end if;
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
 update private.village_life_players set action_points=s.action_points-p_count,materials=m,day=s.day where user_id=u;
 update private.village_life_towns set day=t.day,herb_remaining=t.herb_remaining-case when p_resource='herb' then total else 0 end,
 farm_remaining=t.farm_remaining-case when p_resource='farm' then total else 0 end where id=p_town_id;
 result:=jsonb_build_object('townId',p_town_id,'resource',p_resource,'count',p_count,'actionPointsSpent',p_count,'gains',net_gains,'tax',tax_gains,'taxRate',tax_rate);
 insert into private.village_life_receipts(user_id,request_id,town_id,resource,count,result) values(u,p_request_id,p_town_id,p_resource,p_count,result);
 return jsonb_build_object('state',private.village_life_snapshot(u),'result',result,'replayed',false);
end $function$
;
