-- Retire six unused settlements while preserving all historical receipts, battles and ownership records.
-- Active gameplay towns: city, herb-1, herb-2, farm-1, farm-2.
-- Existing records keep their foreign keys; retired towns are no longer playable or returned in current game state.
ALTER TABLE private.village_life_towns
 ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE private.village_life_towns
 SET is_active=(id IN ('city','herb-1','herb-2','farm-1','farm-2'));

-- Prevent newly seeded towns from becoming playable without a deliberate future migration.
ALTER TABLE private.village_life_towns
 ADD CONSTRAINT village_life_towns_active_five_only
 CHECK (NOT is_active OR id IN ('city','herb-1','herb-2','farm-1','farm-2'));

CREATE OR REPLACE FUNCTION private.guild_materials_state(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare aid uuid;leader boolean;stock jsonb;owned jsonb;history jsonb;personal jsonb;
begin
 select m.association_id,(m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE')
 into aid,leader
 from private.online_association_members m join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select jsonb_object_agg(k,coalesce(s.quantity,0)) into stock
 from unnest(array['herb','pepper','potato','wheat']) k
 left join private.guild_material_stock s on s.association_id=aid and s.material=k;
 select coalesce(materials,'{}'::jsonb) into personal from private.village_life_players where user_id=u;
 select coalesce(jsonb_agg(jsonb_build_object(
  'townId',t.id,'name',t.name,'owned',o.association_id=aid,
  'owner',coalesce(a.name,'중립'),'rate',case when o.association_id is null then 0 when st.owner_association_id=o.association_id then st.tax_rate else 10 end,
  'changedAt',case when st.owner_association_id=o.association_id then st.changed_at else null end
 ) order by t.y,t.x),'[]'::jsonb) into owned
 from private.village_life_towns t
 left join private.village_war_owners o on o.town_id=t.id
 left join private.online_associations a on a.association_id=o.association_id and a.status='ACTIVE'
 left join private.guild_village_tax st on st.town_id=t.id
 where t.is_active;
 select coalesce(jsonb_agg(jsonb_build_object(
  'entryId',e.entry_id,'operation',e.operation,'material',e.material,
  'amount',e.amount,'balanceAfter',e.balance_after,'townId',e.town_id,
  'detail',e.detail,'createdAt',e.created_at,
  'actorName',coalesce((select nick.nickname from public.game_player_profiles nick where nick.user_id=e.actor_user_id),'기록 없음')
 ) order by e.entry_id desc),'[]'::jsonb) into history
 from (select * from private.guild_material_ledger where association_id=aid order by entry_id desc limit 60) e;
 return jsonb_build_object('associationId',aid,'isLeader',leader,
  'materials',coalesce(stock,'{}'::jsonb),'personal',coalesce(personal,'{}'::jsonb),
  'towns',coalesce(owned,'[]'::jsonb),'ledger',coalesce(history,'[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION private.guild_territory_state_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_guild uuid;
 v_leader boolean;
 v_now timestamptz:=clock_timestamp();
 v_today timestamptz;
 v_week timestamptz;
 v_towns jsonb;
 v_history jsonb;
 v_today_total bigint:=0;
 v_week_total bigint:=0;
 v_stock_total bigint:=0;
 v_owned_count integer:=0;
 v_total_count integer:=0;
begin
 select m.association_id, (m.role='LEADER' and a.leader_user_id=p_user and a.status='ACTIVE')
 into v_guild,v_leader
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id
 where m.user_id=p_user and a.status='ACTIVE';
 if v_guild is null then raise exception 'ASSOCIATION_NOT_JOINED';end if;

 v_today:=(date_trunc('day',v_now at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
 v_week:=v_today-interval '6 days';

 select count(*),count(*) filter (where o.association_id=v_guild)
 into v_total_count,v_owned_count
 from private.village_life_towns t
 left join private.village_war_owners o on o.town_id=t.id
 where t.is_active;

 select coalesce(sum(e.amount) filter (where e.created_at>=v_today),0),
        coalesce(sum(e.amount) filter (where e.created_at>=v_week),0)
 into v_today_total,v_week_total
 from private.guild_material_ledger e
 where e.association_id=v_guild and e.operation='GATHER_TAX' and e.created_at>=v_week;

 select coalesce(sum(quantity),0) into v_stock_total
 from private.guild_material_stock where association_id=v_guild;

 select coalesce(jsonb_agg(jsonb_build_object(
  'townId',t.id,'name',t.name,'kind',t.kind,
  'ownerAssociationId',case when a.status='ACTIVE' then o.association_id else null end,
  'ownerName',coalesce(case when a.status='ACTIVE' then a.name end,'중립'),
  'owned',o.association_id=v_guild,
  'occupiedAt',o.occupied_at,
  'rate',case when o.association_id is null or a.status is distinct from 'ACTIVE' then 0
     when rate.owner_association_id=o.association_id then rate.tax_rate else 10 end,
  'changedAt',case when rate.owner_association_id=o.association_id then rate.changed_at else null end,
  'todayTax',coalesce(y.today_tax,0),
  'weekTax',coalesce(y.week_tax,0),
  'todayMaterials',coalesce(y.today_materials,'{}'::jsonb),
  'weekMaterials',coalesce(y.week_materials,'{}'::jsonb)
 ) order by t.y,t.x),'[]'::jsonb)
 into v_towns
 from private.village_life_towns t
 left join private.village_war_owners o on o.town_id=t.id
 left join private.online_associations a on a.association_id=o.association_id
 left join private.guild_village_tax rate on rate.town_id=t.id
 left join lateral (
   select coalesce(sum(s.today_amount),0) as today_tax,
          coalesce(sum(s.amount),0) as week_tax,
          coalesce(jsonb_object_agg(s.material,s.today_amount)
                   filter (where s.today_amount>0),'{}'::jsonb) as today_materials,
          coalesce(jsonb_object_agg(s.material,s.amount),'{}'::jsonb) as week_materials
   from (
     select e.material,sum(e.amount) as amount,
        coalesce(sum(e.amount) filter(where e.created_at>=v_today),0) as today_amount,
        max(e.created_at) as last_at
     from private.guild_material_ledger e
     where e.association_id=v_guild and e.operation='GATHER_TAX'
       and e.town_id=t.id and e.created_at>=v_week
     group by e.material
   ) s
 ) y on true
 where t.is_active;

 select coalesce(jsonb_agg(jsonb_build_object(
   'eventId',h.event_id,'townId',h.town_id,'townName',coalesce(t.name,h.town_id),
   'settledAt',h.settled_at,
   'previousOwner',coalesce(prev.name,'중립'),
   'winner',coalesce(winner.name,'없음'),
   'outcome',case when h.winner_association_id is null then 'UNDECIDED'
    when h.winner_association_id=h.owner_association_id then 'DEFENDED'
    else 'CAPTURED' end,
   'ourWar',h.owner_association_id=v_guild or h.winner_association_id=v_guild
 ) order by h.settled_at desc),'[]'::jsonb)
 into v_history
 from (
  select event_id,town_id,settled_at,owner_association_id,winner_association_id
  from private.village_war_events
  where settled_at is not null
  order by settled_at desc limit 20
 ) h
 left join private.village_life_towns t on t.id=h.town_id
 left join private.online_associations prev on prev.association_id=h.owner_association_id
 left join private.online_associations winner on winner.association_id=h.winner_association_id;

 return jsonb_build_object('associationId',v_guild,'isLeader',v_leader,
   'ownedCount',v_owned_count,'totalCount',v_total_count,
   'todayTax',v_today_total,'weekTax',v_week_total,'stockTotal',v_stock_total,
   'todayStart',v_today,'serverNow',extract(epoch from v_now)*1000,
   'towns',v_towns,'history',v_history);
end
$function$
;

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
  left join private.guild_village_tax ts on ts.town_id=t.id
  where t.is_active;
 return jsonb_build_object('location',s.location,'vitality',life_vitality,'recoveredAt',extract(epoch from life_recovered)*1000,'actionPoints',life_vitality,'materials',s.materials||jsonb_build_object('stone',coalesce((s.materials->>'stone')::bigint,0)), 'products',s.products,'craftMastery',s.craft_mastery,'lifeMasteries',s.life_masteries,'craftCarry',s.craft_carry,'foodTurns',s.food_turns,'wellReadyAt',coalesce(extract(epoch from s.well_ready_at)*1000,0),'health',(select jsonb_build_object('hp',h.current_hp,'maxHp',h.max_hp) from private.hunting_states h where h.user_id=u),'towns',towns,
 'serverNow',extract(epoch from clock_timestamp())*1000,'nextResetAt',extract(epoch from ((today+1)::timestamp at time zone 'Asia/Seoul'))*1000);
end $function$
;

CREATE OR REPLACE FUNCTION private.village_war_event(town text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cycle date;start_at timestamptz;e private.village_war_events%rowtype;aid uuid;
begin
 if not exists(select 1 from private.village_war_settings where enabled) then raise exception 'WAR_FEATURE_DISABLED';end if;
 if not exists(select 1 from private.village_life_towns where id=town and is_active) then raise exception 'WAR_TOWN_INVALID';end if;
 cycle:=date_trunc('week',private.village_war_clock() at time zone 'Asia/Seoul')::date;
 start_at:=(cycle::timestamp+interval '5 days 22 hours') at time zone 'Asia/Seoul';
 select * into e from private.village_war_events where cycle_key=cycle and town_id=town;
 if not found then
  if not pg_try_advisory_xact_lock(hashtextextended('village-event:'||cycle::text||':'||town,0)) then raise exception 'WAR_EVENT_BUSY';end if;
  select * into e from private.village_war_events where cycle_key=cycle and town_id=town;
  if not found then
   select association_id into aid from private.village_war_owners where town_id=town;
   insert into private.village_war_events(cycle_key,town_id,owner_association_id,deployment_starts_at,battle_starts_at,battle_ends_at)
   values(cycle,town,aid,start_at-interval '5 minutes',start_at,start_at+interval '1 hour') returning * into e;
   insert into private.village_war_fronts(event_id,front_id) select e.event_id,generate_series(1,5);
  end if;
 end if;
 if not e.frozen and private.village_war_clock()>=e.battle_starts_at then
  if not pg_try_advisory_xact_lock(hashtextextended('village-freeze:'||e.event_id::text,0)) then raise exception 'WAR_EVENT_BUSY';end if;
  perform 1 from private.village_war_events where event_id=e.event_id for update nowait;
  perform 1 from private.village_war_fronts where event_id=e.event_id order by front_id for update nowait;
  update private.village_war_events set frozen=true where event_id=e.event_id;
  update private.village_war_fronts set occupied_at=e.battle_starts_at where event_id=e.event_id and defender_user_id is not null and occupied_at is null;
 end if;
 return e.event_id;
exception when lock_not_available then raise exception 'WAR_EVENT_BUSY';
end $function$
;

CREATE OR REPLACE FUNCTION public.declare_village_war(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_town_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid;
 w jsonb;
 cycle date;
 aid uuid;
 my_role text;
 existing private.village_war_declaration_receipts%rowtype;
 affected int;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_town_id is null then raise exception 'WAR_REQUEST_INVALID';end if;
 select m.association_id,m.role into aid,my_role
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=u limit 1;
 if aid is null then raise exception 'WAR_GUILD_REQUIRED';end if;
 if my_role<>'LEADER' then raise exception 'WAR_LEADER_REQUIRED';end if;
 -- Serialize a guild's declarations before debiting a leader's ticket balance.
 perform 1 from private.online_associations a where a.association_id=aid for update;
 select * into existing from private.village_war_declaration_receipts r
 where r.user_id=u and r.request_id=p_request_id;
 if found then
   if existing.town_id<>p_town_id or existing.association_id<>aid then
     raise exception 'WAR_REQUEST_CONFLICT';
   end if;
   return jsonb_build_object('replayed',true,'state',
     public.get_village_war_declarations(p_lease_id,p_generation,p_client_instance_id,p_device_id));
 end if;
 w:=private.occupation_window(clock_timestamp());
 if w->>'phase'<>'BIDDING' then raise exception 'WAR_DECLARATION_CLOSED';end if;
 cycle:=(w->>'cycleKey')::date;
 if not exists(select 1 from private.village_life_towns t where t.id=p_town_id and t.is_active) then
   raise exception 'WAR_TOWN_INVALID';
 end if;
 if exists(select 1 from private.village_war_declarations d
  where d.cycle_key=cycle and d.town_id=p_town_id and d.association_id=aid) then
  raise exception 'WAR_ALREADY_DECLARED';
 end if;
 update private.online_associations
 set treasury_tickets=treasury_tickets-100,updated_at=now()
 where association_id=aid and treasury_tickets>=100;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'WAR_GUILD_TICKETS_SHORT';end if;
 insert into private.association_warehouse_ledger(association_id,actor_user_id,operation,currency_type,amount,balance_after,detail)
 select aid,u,'WAR_DECLARATION','TICKET',-100,treasury_tickets,'마을 '||p_town_id||' 선전포고'
 from private.online_associations where association_id=aid;
 perform private.association_activity(aid,u,'WAREHOUSE_SPEND','공용 도전권 100장 · '||p_town_id||' 선전포고');
 insert into private.village_war_declarations(cycle_key,town_id,association_id,declared_by)
 values(cycle,p_town_id,aid,u);
 insert into private.village_war_declaration_receipts(user_id,request_id,cycle_key,town_id,association_id)
 values(u,p_request_id,cycle,p_town_id,aid);
 perform private.broadcast_association_change(aid);
 return jsonb_build_object('replayed',false,'state',
   public.get_village_war_declarations(p_lease_id,p_generation,p_client_instance_id,p_device_id));
end;
$function$
;

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
 select * into t from private.village_life_towns where id=p_town_id and is_active for update;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.set_guild_village_tax(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_town_id text, p_tax_rate integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;aid uuid;current_owner uuid;old private.guild_village_tax%rowtype;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_tax_rate is null or p_tax_rate<0 or p_tax_rate>30 then raise exception 'GUILD_TAX_RATE_INVALID';end if;
 -- Synchronize tax changes with gathering: both lock the town before resolving tax.
 perform 1 from private.village_life_towns where id=p_town_id and is_active for update;
 if not found then raise exception 'TOWN_INVALID';end if;
 select m.association_id into aid
 from private.online_association_members m join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'GUILD_LEADER_ONLY';end if;
 select association_id into current_owner from private.village_war_owners where town_id=p_town_id;
 if current_owner is distinct from aid then raise exception 'GUILD_TOWN_NOT_OWNED';end if;
 select * into old from private.guild_village_tax where town_id=p_town_id for update;
 if found and old.owner_association_id=aid and old.tax_rate=p_tax_rate then return private.guild_materials_state(u);end if;
 if found and old.owner_association_id=aid and old.changed_at>clock_timestamp()-interval '24 hours' then
  raise exception 'GUILD_TAX_COOLDOWN';end if;
 insert into private.guild_village_tax(town_id,owner_association_id,tax_rate,changed_at)
 values(p_town_id,aid,p_tax_rate,clock_timestamp())
 on conflict(town_id) do update set owner_association_id=excluded.owner_association_id,tax_rate=excluded.tax_rate,changed_at=excluded.changed_at;
 perform private.association_activity(aid,u,'AUCTION','마을 '||p_town_id||' 채집 세율 '||p_tax_rate||'% 변경');
 return private.guild_materials_state(u);
end $function$
;

CREATE OR REPLACE FUNCTION public.travel_village(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_town_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_town_id is null or not exists(select 1 from private.village_life_towns where id=p_town_id and is_active) then raise exception 'TOWN_INVALID';end if;
 perform private.refresh_village_life(u);
 update private.village_life_players set location=p_town_id where user_id=u;
 return private.village_life_snapshot(u);
end $function$
;

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
  select t.kind into kind from private.village_life_towns t where t.id=s.location and t.is_active;
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
end $function$
;
-- Audit assertions: exactly five playable towns and no stranded player locations.
DO $$
BEGIN
 IF (SELECT count(*) FROM private.village_life_towns WHERE is_active) <> 5
  THEN RAISE EXCEPTION 'Expected exactly five active towns'; END IF;
 IF EXISTS(
  SELECT 1 FROM private.village_life_players p
  LEFT JOIN private.village_life_towns t ON t.id=p.location
  WHERE t.id IS NULL OR NOT t.is_active
 ) THEN RAISE EXCEPTION 'A player still resides in a retired town'; END IF;
END
$$;
