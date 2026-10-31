-- Weekly SSR pickup: deterministic shuffled rotation for each complete SSR cycle.
-- Monday 00:00 Asia/Seoul; every SSR appears once per rotation (7 weeks for 7 SSRs).
-- This is the source of truth for both the public preview and server-authoritative draws.
create or replace function private.weekly_appearance_pickup_id()
returns text language sql stable security definer set search_path='' as $$
 with w as (
   select ((date_trunc('week',timezone('Asia/Seoul',statement_timestamp()))::date
     - date '2026-10-26')/7)::integer as week_index
 ),
 pool as (select appearance_id from private.appearance_catalog where rarity='SSR'),
 count_pool as (select count(*)::integer as n from pool),
 rotating as (
  select p.appearance_id,
   row_number() over (
    order by md5((floor(w.week_index::numeric / c.n)::integer)::text || ':weekly-ssr:' || p.appearance_id),p.appearance_id
   ) as position,
   (((w.week_index % c.n)+c.n)%c.n)+1 as slot
  from pool p cross join w cross join count_pool c
  where c.n>0
 )
 select appearance_id from rotating where position=slot limit 1
$$;
revoke all on function private.weekly_appearance_pickup_id() from public,anon,authenticated;

-- Public read-only metadata only; no player state, inventory or private catalog rows.
create or replace function public.get_weekly_appearance_pickup()
returns jsonb language sql stable security definer set search_path='' as $$
 with dates as (
  select date_trunc('week',timezone('Asia/Seoul',statement_timestamp()))::date as monday
 ), pool as (
  select count(*)::integer as n from private.appearance_catalog where rarity='SSR'
 )
 select jsonb_build_object(
  'id',private.weekly_appearance_pickup_id(),
  'weekStartKst',to_char(d.monday,'YYYY-MM-DD'),
  'nextWeekStartKst',to_char(d.monday+7,'YYYY-MM-DD'),
  'ssrCount',p.n,
  'ssrRatePercent',0.2,
  'pickupRatePercent',case when p.n>1 then 0.1 else 0.2 end
 ) from dates d cross join pool p
$$;
revoke all on function public.get_weekly_appearance_pickup() from public,anon,authenticated;
grant execute on function public.get_weekly_appearance_pickup() to anon,authenticated;

-- Keep all existing session guards, tickets-first settlement and receipt idempotency.

create or replace function public.summon_appearances(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_currency text,p_rolls integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid; r private.appearance_summon_receipts%rowtype;
 ticket_balance bigint:=0; ticket_spend bigint; gold_spend bigint; payment jsonb;
 settlement text; draws jsonb:='[]'::jsonb; i integer; bucket integer; tier text;
 pool text[]; chosen text; pickup_id text; was_owned boolean; fragments_now bigint; level_now integer;
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

 pickup_id:=private.weekly_appearance_pickup_id();
 for i in 1..p_rolls loop
  bucket:=private.appearance_secure_int(10000);
  tier:=case when bucket<6000 then 'C' when bucket<9000 then 'B'
            when bucket<9800 then 'A' when bucket<9980 then 'SR' else 'SSR' end;
  select array_agg(appearance_id order by appearance_id) into pool
  from private.appearance_catalog where rarity=tier;
  if coalesce(cardinality(pool),0)=0 then raise exception 'SUMMON_POOL_EMPTY';end if;
  if tier='SSR' and cardinality(pool)>1 and pickup_id=any(pool) then
   -- SSR stays 0.2% overall. Half of SSR rolls target this week's pickup.
   -- The remaining half is divided equally across non-pickup SSR appearances.
   if private.appearance_secure_int(2)=0 then
    chosen:=pickup_id;
   else
    pool:=array_remove(pool,pickup_id);
    chosen:=pool[private.appearance_secure_int(cardinality(pool))+1];
   end if;
  else
   chosen:=pool[private.appearance_secure_int(cardinality(pool))+1];
  end if;
  select exists(select 1 from private.appearance_ownership
                where user_id=u and appearance_id=chosen and enhancement_level>0) into was_owned;
  insert into private.appearance_ownership(user_id,appearance_id,duplicate_count,fragment_balance,enhancement_level)
   values(u,chosen,0,1,0)
   on conflict(user_id,appearance_id) do update
   set duplicate_count=private.appearance_ownership.duplicate_count+1,
       fragment_balance=private.appearance_ownership.fragment_balance+1
   returning fragment_balance,enhancement_level into fragments_now,level_now;
  draws:=draws||jsonb_build_array(jsonb_build_object(
    'id',chosen,'rarity',tier,'duplicate',was_owned,'fragments',1,
    'fragmentBalance',fragments_now,'level',level_now));
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
revoke all on function public.summon_appearances(uuid,bigint,text,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.summon_appearances(uuid,bigint,text,text,uuid,text,integer) to authenticated;
