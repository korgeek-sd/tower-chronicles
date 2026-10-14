-- Guild leader discretionary treasury transfers, fully logged and contribution-neutral.
alter table private.association_warehouse_ledger
 drop constraint if exists association_warehouse_ledger_operation_check;
alter table private.association_warehouse_ledger
 add constraint association_warehouse_ledger_operation_check
 check (operation in ('DEPOSIT','WAR_DECLARATION','HUNT_TAX','EXPEDITION_TAX','LEADER_DEPOSIT','LEADER_WITHDRAW'));

create table if not exists private.association_treasury_transfers(
 transfer_id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id),
 request_id uuid not null,
 association_id uuid not null references private.online_associations(association_id),
 direction text not null check(direction in ('DEPOSIT','WITHDRAW')),
 currency_type text not null check(currency_type in ('SILVER','GOLD','TICKET')),
 amount bigint not null check(amount>0),
 note text not null default '',
 ledger_entry_id bigint not null unique references private.association_warehouse_ledger(entry_id),
 created_at timestamptz not null default now(),
 unique(user_id,request_id)
);
create index if not exists association_treasury_transfers_by_guild
 on private.association_treasury_transfers(association_id,transfer_id desc);
alter table private.association_treasury_transfers enable row level security;
revoke all on private.association_treasury_transfers from public,anon,authenticated;

create or replace function public.transfer_association_treasury(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_direction text,p_currency text,p_amount bigint,p_note text default ''
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; aid uuid; a private.online_associations%rowtype; w private.player_wallets%rowtype;
 old_transfer private.association_treasury_transfers%rowtype;
 note_text text; changed integer; signed_amount bigint; after_balance bigint; log_id bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_direction is null or p_direction not in ('DEPOSIT','WITHDRAW')
  or p_currency is null or p_currency not in ('SILVER','GOLD','TICKET')
  or p_amount is null or p_amount<=0 or p_amount>1000000000
  or char_length(coalesce(p_note,''))>100
 then raise exception 'WAREHOUSE_INPUT_INVALID';end if;
 note_text:=btrim(coalesce(p_note,''));
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 if exists(select 1 from private.online_expeditions e where e.user_id=u and e.status='ACTIVE')
  or exists(select 1 from public.game_saves s where s.user_id=u and
   jsonb_typeof(s.payload->'expedition')='object') then
  raise exception 'WAREHOUSE_DURING_EXPEDITION';end if;
 select * into w from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select g.* into a from private.online_associations g
 join private.online_association_members m on m.association_id=g.association_id
 where m.user_id=u and m.role='LEADER' and g.leader_user_id=u and g.status='ACTIVE'
 for update of g;
 if not found then raise exception 'WAREHOUSE_LEADER_ONLY';end if;
 aid:=a.association_id;
 select * into old_transfer from private.association_treasury_transfers
  where user_id=u and request_id=p_request_id;
 if found then
  if old_transfer.association_id<>aid or old_transfer.direction<>p_direction
   or old_transfer.currency_type<>p_currency or old_transfer.amount<>p_amount
   or old_transfer.note<>note_text then raise exception 'WAREHOUSE_REQUEST_CONFLICT';end if;
  return jsonb_build_object('replayed',true,
   'warehouse',private.association_warehouse_json(u),'record',private.cloud_record_json(u));
 end if;
 if p_direction='DEPOSIT' then
  if (p_currency='SILVER' and w.silver<p_amount)
   or (p_currency='GOLD' and w.gold<p_amount) then raise exception 'WAREHOUSE_BALANCE_SHORTAGE';end if;
 else
  if (p_currency='SILVER' and a.treasury_silver<p_amount)
   or (p_currency='GOLD' and a.treasury_gold<p_amount)
   or (p_currency='TICKET' and a.treasury_tickets<p_amount) then
   raise exception 'WAREHOUSE_TREASURY_SHORTAGE';end if;
 end if;
 signed_amount:=case when p_direction='DEPOSIT' then p_amount else -p_amount end;
 if p_currency in ('SILVER','GOLD') then
  update private.player_wallets set
   silver=silver-case when p_currency='SILVER' then signed_amount else 0 end,
   gold=gold-case when p_currency='GOLD' then signed_amount else 0 end,
   updated_at=now()
  where user_id=u;
 else
  update private.village_life_players
  set products=jsonb_set(coalesce(products,'{}'::jsonb),'{challenge_ticket}',
   to_jsonb(coalesce((products->>'challenge_ticket')::bigint,0)-signed_amount),true)
  where user_id=u and
    (p_direction='WITHDRAW' or coalesce((products->>'challenge_ticket')::bigint,0)>=p_amount);
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'WAREHOUSE_BALANCE_SHORTAGE';end if;
 end if;
 update private.online_associations set
  treasury_silver=treasury_silver+case when p_currency='SILVER' then signed_amount else 0 end,
  treasury_gold=treasury_gold+case when p_currency='GOLD' then signed_amount else 0 end,
  treasury_tickets=treasury_tickets+case when p_currency='TICKET' then signed_amount else 0 end,
  updated_at=now()
 where association_id=aid
 returning case p_currency when 'SILVER' then treasury_silver when 'GOLD' then treasury_gold else treasury_tickets end into after_balance;
 insert into private.association_warehouse_ledger(
  association_id,actor_user_id,operation,currency_type,amount,balance_after,detail
 ) values(aid,u,'LEADER_'||p_direction,p_currency,signed_amount,after_balance,
  case when p_direction='DEPOSIT' then '길드장 입금' else '길드장 인출' end ||
  case when note_text<>'' then ' · '||note_text else '' end)
 returning entry_id into log_id;
 insert into private.association_treasury_transfers(
  user_id,request_id,association_id,direction,currency_type,amount,note,ledger_entry_id
 ) values(u,p_request_id,aid,p_direction,p_currency,p_amount,note_text,log_id);
 perform private.association_activity(aid,u,'WAREHOUSE_'||p_direction,
  case when p_direction='DEPOSIT' then '길드장 금고 입금: ' else '길드장 금고 인출: ' end ||
  p_amount::text||' '||p_currency||
  case when note_text<>'' then ' · '||note_text else '' end);
 if p_currency in ('SILVER','GOLD') then
  perform private.persist_server_association_to_save(u);
 end if;
 perform private.broadcast_association_change(aid);
 return jsonb_build_object('replayed',false,'ledgerEntryId',log_id,
  'warehouse',private.association_warehouse_json(u),'record',private.cloud_record_json(u));
end;$$;

create or replace function public.get_association_warehouse_history(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_before_id bigint default null,p_withdrawals_only boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; aid uuid; entries jsonb; has_more boolean;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=u;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 if p_before_id is not null and p_before_id<=0 then raise exception 'WAREHOUSE_INPUT_INVALID';end if;
 select coalesce(jsonb_agg(x.obj order by x.entry_id desc),'[]'::jsonb)
 into entries from(
  select e.entry_id,jsonb_build_object(
   'entryId',e.entry_id,'operation',e.operation,'currency',e.currency_type,
   'amount',e.amount,'balanceAfter',e.balance_after,'detail',e.detail,
   'actorName',coalesce((select nickname from public.game_player_profiles where user_id=e.actor_user_id),'탐사자'),
   'createdAt',e.created_at
  ) obj from private.association_warehouse_ledger e
  where e.association_id=aid and (p_before_id is null or e.entry_id<p_before_id)
   and (not p_withdrawals_only or e.operation='LEADER_WITHDRAW')
  order by e.entry_id desc limit 50
 ) x;
 select exists(
  select 1 from private.association_warehouse_ledger e
  where e.association_id=aid
   and (not p_withdrawals_only or e.operation='LEADER_WITHDRAW')
   and e.entry_id<coalesce((select min((r->>'entryId')::bigint) from jsonb_array_elements(entries) r),0)
 ) into has_more;
 return jsonb_build_object('ledger',entries,'hasMore',has_more);
end;$$;

revoke all on function public.transfer_association_treasury(uuid,bigint,text,text,uuid,text,text,bigint,text)
 from public,anon,authenticated;
grant execute on function public.transfer_association_treasury(uuid,bigint,text,text,uuid,text,text,bigint,text)
 to authenticated;
revoke all on function public.get_association_warehouse_history(uuid,bigint,text,text,bigint,boolean)
 from public,anon,authenticated;
grant execute on function public.get_association_warehouse_history(uuid,bigint,text,text,bigint,boolean)
 to authenticated;
