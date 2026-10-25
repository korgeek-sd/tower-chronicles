-- Appearance summoning consumes tickets before Gold, with partial tickets in 10-draw bundles.
-- 1 draw: 1 ticket or 300G. 10 draws: up to 10 tickets, 270G per uncovered draw.
-- Preserve the original RPC signature so cached older clients cannot bypass ticket priority.

alter table private.appearance_summon_receipts
 add column tickets_spent bigint not null default 0 check(tickets_spent>=0),
 add column gold_spent bigint not null default 0 check(gold_spent>=0);

-- Historical receipts keep their original settlement totals.
update private.appearance_summon_receipts
set tickets_spent=case when currency='ticket' then cost else 0 end,
    gold_spent=case when currency='gold' then cost else 0 end;

alter table private.appearance_summon_receipts
 drop constraint appearance_summon_receipts_currency_check;
alter table private.appearance_summon_receipts
 add constraint appearance_summon_receipts_currency_check
 check(currency in ('gold','ticket','mixed'));

create function private.appearance_payment(p_rolls integer,p_ticket_balance bigint)
returns jsonb language plpgsql immutable set search_path='' as $$
declare ticket_count bigint; gold_count bigint;
begin
 if p_rolls is null or p_rolls not in (1,10) or p_ticket_balance is null or p_ticket_balance<0
 then raise exception 'SUMMON_INVALID';end if;
 ticket_count:=least(p_rolls::bigint,p_ticket_balance);
 gold_count:=(p_rolls-ticket_count)*(case when p_rolls=10 then 270 else 300 end);
 return jsonb_build_object('ticketsSpent',ticket_count,'goldSpent',gold_count);
end $$;
revoke all on function private.appearance_payment(integer,bigint) from public,anon,authenticated;

create or replace function public.summon_appearances(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_currency text,p_rolls integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid; r private.appearance_summon_receipts%rowtype;
 ticket_balance bigint:=0; ticket_spend bigint; gold_spend bigint; payment jsonb;
 settlement text; draws jsonb:='[]'::jsonb; i integer; bucket integer; tier text;
 pool text[]; chosen text; was_owned boolean;
begin
 -- Session lock and canonical save/wallet order match existing economy mutations.
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 -- Old game bundles may send 'gold'/'ticket'; both now use mandatory automatic priority.
 if p_request_id is null or p_currency is null
    or p_currency not in ('auto','gold','ticket') or p_rolls is null or p_rolls not in (1,10)
 then raise exception 'SUMMON_INVALID';end if;

 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into r from private.appearance_summon_receipts
 where user_id=u and request_id=p_request_id;
 if found then
  if r.rolls<>p_rolls then raise exception 'SUMMON_REQUEST_CONFLICT';end if;
  return jsonb_build_object(
    'draws',r.results,'cost',r.cost,'currency',r.currency,
    'ticketsSpent',r.tickets_spent,'goldSpent',r.gold_spent,
    'replayed',true,'record',private.cloud_record_json(u));
 end if;

 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select quantity into ticket_balance from private.appearance_ticket_wallets
 where user_id=u for update;
 ticket_balance:=coalesce(ticket_balance,0);
 payment:=private.appearance_payment(p_rolls,ticket_balance);
 ticket_spend:=(payment->>'ticketsSpent')::bigint;
 gold_spend:=(payment->>'goldSpent')::bigint;

 -- Both deductions and all rewards are rolled back if any part fails.
 update private.player_wallets set gold=gold-gold_spend,updated_at=now()
 where user_id=u and gold>=gold_spend;
 if not found then raise exception 'SUMMON_GOLD_INSUFFICIENT';end if;
 if ticket_spend>0 then
  update private.appearance_ticket_wallets set quantity=quantity-ticket_spend
  where user_id=u and quantity>=ticket_spend;
  if not found then raise exception 'SUMMON_TICKET_INSUFFICIENT';end if;
 end if;

 for i in 1..p_rolls loop
  bucket:=private.appearance_secure_int(10000);
  tier:=case when bucket<6000 then 'C' when bucket<9000 then 'B'
            when bucket<9800 then 'A' when bucket<9980 then 'SR' else 'SSR' end;
  select array_agg(appearance_id order by appearance_id) into pool
  from private.appearance_catalog where rarity=tier;
  if coalesce(cardinality(pool),0)=0 then raise exception 'SUMMON_POOL_EMPTY';end if;
  chosen:=pool[private.appearance_secure_int(cardinality(pool))+1];
  select exists(select 1 from private.appearance_ownership
                where user_id=u and appearance_id=chosen) into was_owned;
  insert into private.appearance_ownership(user_id,appearance_id,duplicate_count)
   values(u,chosen,0)
   on conflict(user_id,appearance_id) do update
   set duplicate_count=private.appearance_ownership.duplicate_count+1;
  draws:=draws||jsonb_build_array(jsonb_build_object('id',chosen,'rarity',tier,'duplicate',was_owned));
 end loop;

 settlement:=case when ticket_spend=0 then 'gold'
                  when gold_spend=0 then 'ticket' else 'mixed' end;
 insert into private.appearance_summon_receipts(
  user_id,request_id,currency,rolls,cost,results,tickets_spent,gold_spent)
 values(u,p_request_id,settlement,p_rolls,gold_spend,draws,ticket_spend,gold_spend);
 perform private.persist_market_economy_to_save(u);
 return jsonb_build_object(
  'draws',draws,'cost',gold_spend,'currency',settlement,
  'ticketsSpent',ticket_spend,'goldSpent',gold_spend,
  'replayed',false,'record',private.cloud_record_json(u));
end $$;
revoke all on function public.summon_appearances(uuid,bigint,text,text,uuid,text,integer)
 from public,anon,authenticated;
grant execute on function public.summon_appearances(uuid,bigint,text,text,uuid,text,integer)
 to authenticated;

create or replace function public.get_appearance_summon_history(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; history jsonb;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select coalesce(jsonb_agg(jsonb_build_object(
    'draws',results,'cost',cost,'currency',currency,'ticketsSpent',tickets_spent,
    'goldSpent',gold_spent,'at',created_at) order by created_at desc),'[]'::jsonb)
 into history from (
  select results,cost,currency,tickets_spent,gold_spent,created_at
  from private.appearance_summon_receipts
  where user_id=u order by created_at desc limit 20
 ) h;
 return jsonb_build_object('history',history);
end $$;
revoke all on function public.get_appearance_summon_history(uuid,bigint,text,text)
 from public,anon,authenticated;
grant execute on function public.get_appearance_summon_history(uuid,bigint,text,text)
 to authenticated;
