-- Guild treasury: existing silver, plus shared gold and war tickets.
alter table private.online_associations
 add column if not exists treasury_gold bigint not null default 0 check(treasury_gold>=0),
 add column if not exists treasury_tickets bigint not null default 0 check(treasury_tickets>=0);
create table if not exists private.association_warehouse_ledger(
 entry_id bigint generated always as identity primary key,
 association_id uuid not null references private.online_associations(association_id) on delete cascade,
 actor_user_id uuid not null references auth.users(id),
 operation text not null check(operation in ('DEPOSIT','WAR_DECLARATION')),
 currency_type text not null check(currency_type in ('SILVER','GOLD','TICKET')),
 amount bigint not null check(amount<>0),
 balance_after bigint not null check(balance_after>=0),
 detail text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists association_warehouse_ledger_assoc_time_idx on private.association_warehouse_ledger(association_id,entry_id desc);
alter table private.association_warehouse_ledger enable row level security;
revoke all on private.association_warehouse_ledger from public,anon,authenticated;
create table if not exists private.association_warehouse_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 association_id uuid not null references private.online_associations(association_id) on delete cascade,
 currency_type text not null,
 amount bigint not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.association_warehouse_receipts enable row level security;
revoke all on private.association_warehouse_receipts from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.association_warehouse_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare aid uuid; a private.online_associations%rowtype; logs jsonb; personal_silver bigint; personal_gold bigint; personal_tickets bigint; role_name text;
begin
 select m.association_id,m.role into aid,role_name from private.online_association_members m
 join private.online_associations g on g.association_id=m.association_id and g.status='ACTIVE'
 where m.user_id=p_user;
 if aid is null then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into a from private.online_associations where association_id=aid;
 select w.silver,w.gold into personal_silver,personal_gold from private.player_wallets w where w.user_id=p_user;
 select coalesce((l.products->>'challenge_ticket')::bigint,0) into personal_tickets from private.village_life_players l where l.user_id=p_user;
 select coalesce(jsonb_agg(x.obj order by x.entry_id desc),'[]'::jsonb) into logs from (
  select e.entry_id,jsonb_build_object(
   'entryId',e.entry_id,'operation',e.operation,'currency',e.currency_type,
   'amount',e.amount,'balanceAfter',e.balance_after,'detail',e.detail,
   'actorName',coalesce((select nickname from public.game_player_profiles where user_id=e.actor_user_id),'탐사자'),
   'createdAt',e.created_at
  ) as obj
  from private.association_warehouse_ledger e where e.association_id=aid
  order by e.entry_id desc limit 50
 ) x;
 return jsonb_build_object(
  'associationId',aid,'associationName',a.name,'myRole',role_name,
  'silver',a.treasury_silver,'gold',a.treasury_gold,'tickets',a.treasury_tickets,
  'personalSilver',coalesce(personal_silver,0),'personalGold',coalesce(personal_gold,0),
  'personalTickets',coalesce(personal_tickets,0),'ledger',logs
 );
end $function$


;

CREATE OR REPLACE FUNCTION public.get_association_warehouse(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.association_warehouse_json(u);
end $function$


;

CREATE OR REPLACE FUNCTION public.deposit_association_warehouse(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_currency text, p_amount bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid; aid uuid; changed int; existing private.association_warehouse_receipts%rowtype; new_balance bigint; w private.player_wallets%rowtype;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_currency is null or p_currency not in ('SILVER','GOLD','TICKET')
  or p_amount is null or p_amount<=0 or p_amount>1000000000
 then raise exception 'WAREHOUSE_INPUT_INVALID';end if;
 -- Serializes economy mutation families and prevents old client-snapshot overwrites.
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into w from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=u for share of m;
 if aid is null then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 perform 1 from private.online_associations where association_id=aid for update;
 select * into existing from private.association_warehouse_receipts where user_id=u and request_id=p_request_id;
 if found then
  if existing.association_id<>aid or existing.currency_type<>p_currency or existing.amount<>p_amount
  then raise exception 'WAREHOUSE_REQUEST_CONFLICT';end if;
  return jsonb_build_object('warehouse',private.association_warehouse_json(u),
   'record',private.cloud_record_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
 then raise exception 'WAREHOUSE_DURING_EXPEDITION';end if;
 if p_currency in ('SILVER','GOLD') then
  if (p_currency='SILVER' and w.silver<p_amount) or (p_currency='GOLD' and w.gold<p_amount)
  then raise exception 'WAREHOUSE_BALANCE_SHORTAGE';end if;
  update private.player_wallets
  set silver=silver-case when p_currency='SILVER' then p_amount else 0 end,
      gold=gold-case when p_currency='GOLD' then p_amount else 0 end,
      updated_at=now()
  where user_id=u;
 else
  update private.village_life_players
  set products=jsonb_set(products,'{challenge_ticket}',
    to_jsonb(coalesce((products->>'challenge_ticket')::bigint,0)-p_amount),true)
  where user_id=u and coalesce((products->>'challenge_ticket')::bigint,0)>=p_amount;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'WAREHOUSE_BALANCE_SHORTAGE';end if;
 end if;
 update private.online_associations set
   treasury_silver=treasury_silver+case when p_currency='SILVER' then p_amount else 0 end,
   treasury_gold=treasury_gold+case when p_currency='GOLD' then p_amount else 0 end,
   treasury_tickets=treasury_tickets+case when p_currency='TICKET' then p_amount else 0 end,
   updated_at=now()
 where association_id=aid
 returning case p_currency when 'SILVER' then treasury_silver when 'GOLD' then treasury_gold else treasury_tickets end into new_balance;
 insert into private.association_warehouse_ledger(association_id,actor_user_id,operation,currency_type,amount,balance_after,detail)
 values(aid,u,'DEPOSIT',p_currency,p_amount,new_balance,'원정단 창고 기부');
 insert into private.association_warehouse_receipts(user_id,request_id,association_id,currency_type,amount)
 values(u,p_request_id,aid,p_currency,p_amount);
 perform private.association_activity(aid,u,'WAREHOUSE_DEPOSIT',
  case p_currency when 'SILVER' then '실버' when 'GOLD' then '골드' else '도전권' end||' '||p_amount::text||'개 창고 기부');
 if p_currency in ('SILVER','GOLD') then perform private.persist_server_association_to_save(u);end if;
 perform private.broadcast_association_change(aid);
 return jsonb_build_object('warehouse',private.association_warehouse_json(u),
  'record',private.cloud_record_json(u),'replayed',false);
end $function$


;

CREATE OR REPLACE FUNCTION public.get_village_war_declarations(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
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
 tickets bigint := 0;
 items jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 w:=private.occupation_window(clock_timestamp());
 cycle:=(w->>'cycleKey')::date;
 select m.association_id,m.role into aid,my_role
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=u limit 1;
 select coalesce((l.products->>'challenge_ticket')::bigint,0) into tickets
 from private.village_life_players l where l.user_id=u;
 select coalesce(jsonb_agg(jsonb_build_object(
   'townId',d.town_id,
   'associationId',d.association_id,
   'associationName',a.name
 ) order by d.town_id,d.declared_at), '[]'::jsonb) into items
 from private.village_war_declarations d
 join private.online_associations a on a.association_id=d.association_id
 where d.cycle_key=cycle;
 return jsonb_build_object(
   'cycleKey',w->>'cycleKey','phase',w->>'phase',
   'bidClosesAt',w->>'bidClosesAt','battleStartsAt',w->>'battleStartsAt',
   'myAssociationId',aid,'myRole',my_role,
   'tickets',coalesce(tickets,0),'guildTickets',coalesce((select treasury_tickets from private.online_associations where association_id=aid),0),'declarations',items);
end;
$function$


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
 if not exists(select 1 from private.village_life_towns t where t.id=p_town_id) then
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

revoke all on function private.association_warehouse_json(uuid) from public,anon,authenticated;
revoke all on function public.get_association_warehouse(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_association_warehouse(uuid,bigint,text,text) to authenticated;
revoke all on function public.deposit_association_warehouse(uuid,bigint,text,text,uuid,text,bigint) from public,anon;
grant execute on function public.deposit_association_warehouse(uuid,bigint,text,text,uuid,text,bigint) to authenticated;
