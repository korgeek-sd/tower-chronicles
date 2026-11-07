-- 20261107163408: 30-day free attendance, Seoul midnight boundaries.
-- This migration was applied to the production Supabase project under the same version.
-- Client requests never supply dates, silver, or ticket quantities.
create table if not exists private.free_attendance_cycles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 cycle_number bigint not null default 1 check (cycle_number > 0),
 started_on date not null,
 updated_at timestamptz not null default now()
);
create table if not exists private.free_attendance_claims (
 user_id uuid not null references auth.users(id) on delete cascade,
 cycle_number bigint not null check (cycle_number > 0),
 day_number integer not null check (day_number between 1 and 30),
 claimed_on date not null,
 silver_granted bigint not null check (silver_granted = 3000),
 tickets_granted bigint not null check (tickets_granted in (0, 5)),
 created_at timestamptz not null default now(),
 primary key (user_id, cycle_number, day_number),
 unique (user_id, claimed_on)
);
create index if not exists free_attendance_claims_cycle_idx on private.free_attendance_claims(user_id, cycle_number);
alter table private.free_attendance_cycles enable row level security;
alter table private.free_attendance_claims enable row level security;
revoke all on private.free_attendance_cycles, private.free_attendance_claims from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.free_attendance_status_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
 v_today date := (now() at time zone 'Asia/Seoul')::date;
 v_cycle private.free_attendance_cycles%rowtype;
 v_started_on date;
 v_cycle_number bigint;
 v_current_day integer;
 v_claimed_days jsonb := '[]'::jsonb;
 v_claimed_today boolean := false;
begin
 select * into v_cycle from private.free_attendance_cycles where user_id = p_user;
 if not found then
   v_started_on := v_today;
   v_cycle_number := 1;
 elsif v_today >= v_cycle.started_on + 30 then
   -- The next thirty-day period begins only at the next actual claim.
   v_started_on := v_today;
   v_cycle_number := v_cycle.cycle_number + 1;
 else
   v_started_on := v_cycle.started_on;
   v_cycle_number := v_cycle.cycle_number;
 end if;
 v_current_day := greatest(1, least(30, (v_today - v_started_on) + 1));
 select coalesce(jsonb_agg(c.day_number order by c.day_number),'[]'::jsonb)
 into v_claimed_days
 from private.free_attendance_claims c
 where c.user_id = p_user and c.cycle_number = v_cycle_number;
 select exists (
   select 1 from private.free_attendance_claims c
   where c.user_id = p_user and c.cycle_number = v_cycle_number
     and c.day_number = v_current_day and c.claimed_on = v_today
 ) into v_claimed_today;
 return jsonb_build_object(
   'todayKst', v_today, 'cycleStartKst', v_started_on,
   'cycleNumber', v_cycle_number, 'currentDay', v_current_day,
   'claimedDays', v_claimed_days, 'todayClaimed', v_claimed_today
 );
end;$function$;

CREATE OR REPLACE FUNCTION public.get_free_attendance_status(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid;
begin
 v_user := private.require_active_game_session(
   p_lease_id, p_generation, p_client_instance_id, p_device_id
 );
 return private.free_attendance_status_json(v_user);
end;$function$;

CREATE OR REPLACE FUNCTION public.claim_free_attendance(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid;
 v_today date := (now() at time zone 'Asia/Seoul')::date;
 v_cycle private.free_attendance_cycles%rowtype;
 v_day integer;
 v_tickets bigint;
 v_status jsonb;
begin
 -- Share the existing economy mutation lock with appearance summons.
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations', 0));
 v_user := private.require_active_game_session(
   p_lease_id, p_generation, p_client_instance_id, p_device_id
 );
 perform 1 from public.game_saves where user_id = v_user for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
 perform private.sync_market_economy_from_latest_save(v_user);
 perform 1 from private.player_wallets where user_id = v_user for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED'; end if;

 select * into v_cycle from private.free_attendance_cycles
 where user_id = v_user for update;
 if not found then
   insert into private.free_attendance_cycles(user_id, cycle_number, started_on)
   values (v_user, 1, v_today) returning * into v_cycle;
 elsif v_today >= v_cycle.started_on + 30 then
   update private.free_attendance_cycles
      set cycle_number = v_cycle.cycle_number + 1,
          started_on = v_today, updated_at = now()
    where user_id = v_user returning * into v_cycle;
 end if;

 v_day := (v_today - v_cycle.started_on) + 1;
 if v_day < 1 or v_day > 30 then raise exception 'ATTENDANCE_DAY_INVALID'; end if;
 if exists (
    select 1 from private.free_attendance_claims
    where user_id = v_user and cycle_number = v_cycle.cycle_number and day_number = v_day
 ) then
   return jsonb_build_object(
     'alreadyClaimed', true, 'reward', jsonb_build_object('silver', 0, 'tickets', 0),
     'status', private.free_attendance_status_json(v_user),
     'record', private.cloud_record_json(v_user)
   );
 end if;

 v_tickets := case when v_day % 5 = 0 then 5 else 0 end;
 insert into private.free_attendance_claims
   (user_id, cycle_number, day_number, claimed_on, silver_granted, tickets_granted)
 values (v_user, v_cycle.cycle_number, v_day, v_today, 3000, v_tickets);

 update private.player_wallets
   set silver = silver + 3000, updated_at = now()
 where user_id = v_user;
 if v_tickets > 0 then
   insert into private.appearance_ticket_wallets(user_id, quantity)
   values (v_user, v_tickets)
   on conflict (user_id) do update
     set quantity = private.appearance_ticket_wallets.quantity + excluded.quantity;
 end if;

 -- Persist silver in the server-authoritative cloud record; summon tickets
 -- already live in the separate server wallet consumed by summon_appearances.
 perform private.persist_market_economy_to_save(v_user);
 v_status := private.free_attendance_status_json(v_user);
 return jsonb_build_object(
   'alreadyClaimed', false,
   'reward', jsonb_build_object('silver', 3000, 'tickets', v_tickets),
   'status', v_status, 'record', private.cloud_record_json(v_user)
 );
end;$function$;

-- Public RPC calls are deliberately limited to authenticated, lease-verified players.
revoke all on function public.get_free_attendance_status(uuid,bigint,text,text) from public, anon;
revoke all on function public.claim_free_attendance(uuid,bigint,text,text) from public, anon;
grant execute on function public.get_free_attendance_status(uuid,bigint,text,text) to authenticated;
grant execute on function public.claim_free_attendance(uuid,bigint,text,text) to authenticated;
