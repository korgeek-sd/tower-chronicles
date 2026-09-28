-- v0.1.65: server-authoritative weekly occupation war V1.
-- KST cycle: bid Mon 00:00 -> Fri 22:00, battle Sat 22:00 -> 22:30.
-- Three fronts. Final control of two or more fronts wins the tower.

create table if not exists private.occupation_tower_state (
  tower text primary key check (tower in ('ore','leather','gem','kaleon')),
  owner_group_key text,
  owner_group_name text,
  occupied_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table private.occupation_tower_state enable row level security;
revoke all on private.occupation_tower_state from public,anon,authenticated;

create table if not exists private.occupation_merit (
  group_key text not null,
  group_name text not null,
  tower text not null check (tower in ('ore','leather','gem','kaleon')),
  balance bigint not null default 0 check (balance>=0),
  updated_at timestamptz not null default now(),
  primary key(group_key,tower)
);
alter table private.occupation_merit enable row level security;
revoke all on private.occupation_merit from public,anon,authenticated;

create table if not exists private.occupation_bids (
  bid_id uuid primary key default gen_random_uuid(),
  cycle_key date not null,
  tower text not null check (tower in ('ore','leather','gem','kaleon')),
  group_key text not null,
  group_name text not null,
  total_merit bigint not null default 0 check (total_merit>=0),
  first_reached_at timestamptz not null default now(),
  last_bid_at timestamptz not null default now(),
  status text not null default 'OPEN' check (status in ('OPEN','WON','LOST')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cycle_key,group_key)
);
create index if not exists occupation_bids_tower_rank_idx
on private.occupation_bids(cycle_key,tower,status,total_merit desc,first_reached_at asc);
alter table private.occupation_bids enable row level security;
revoke all on private.occupation_bids from public,anon,authenticated;

create table if not exists private.occupation_matches (
  match_id uuid primary key default gen_random_uuid(),
  cycle_key date not null,
  tower text not null check (tower in ('ore','leather','gem','kaleon')),
  attacker_group_key text not null,
  attacker_group_name text not null,
  defender_group_key text,
  defender_group_name text,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','ATTACKER_WIN','DEFENDER_WIN')),
  battle_starts_at timestamptz not null,
  battle_ends_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cycle_key,tower)
);
alter table private.occupation_matches enable row level security;
revoke all on private.occupation_matches from public,anon,authenticated;

create table if not exists private.occupation_front_scores (
  match_id uuid not null references private.occupation_matches(match_id) on delete cascade,
  front text not null check (front in ('LEFT','CENTER','RIGHT')),
  attacker_wins bigint not null default 0 check (attacker_wins>=0),
  defender_wins bigint not null default 0 check (defender_wins>=0),
  updated_at timestamptz not null default now(),
  primary key(match_id,front)
);
alter table private.occupation_front_scores enable row level security;
revoke all on private.occupation_front_scores from public,anon,authenticated;

create table if not exists private.occupation_participants (
  match_id uuid not null references private.occupation_matches(match_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  group_key text not null,
  side text not null check (side in ('ATTACKER','DEFENDER')),
  front text not null check (front in ('LEFT','CENTER','RIGHT')),
  combat_stats jsonb not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','DUEL','READY')),
  queued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(match_id,user_id)
);
create index if not exists occupation_participants_queue_idx
on private.occupation_participants(match_id,front,side,status,queued_at);
alter table private.occupation_participants enable row level security;
revoke all on private.occupation_participants from public,anon,authenticated;

create table if not exists private.occupation_duels (
  duel_id uuid primary key default gen_random_uuid(),
  match_id uuid not null references private.occupation_matches(match_id) on delete cascade,
  front text not null check (front in ('LEFT','CENTER','RIGHT')),
  attacker_user_id uuid not null references auth.users(id) on delete cascade,
  defender_user_id uuid not null references auth.users(id) on delete cascade,
  attacker_stats jsonb not null,
  defender_stats jsonb not null,
  attacker_hp bigint not null check (attacker_hp>=0),
  defender_hp bigint not null check (defender_hp>=0),
  attacker_guard boolean not null default false,
  defender_guard boolean not null default false,
  current_actor uuid not null references auth.users(id) on delete cascade,
  action_nonce bigint not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','FINISHED')),
  winner_side text check (winner_side is null or winner_side in ('ATTACKER','DEFENDER')),
  winner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists occupation_duels_active_user_idx
on private.occupation_duels(match_id,status,attacker_user_id,defender_user_id);
alter table private.occupation_duels enable row level security;
revoke all on private.occupation_duels from public,anon,authenticated;

insert into private.occupation_tower_state(tower)
values('ore'),('leather'),('gem'),('kaleon')
on conflict(tower) do nothing;

create or replace function private.occupation_window(p_now timestamptz default clock_timestamp())
returns jsonb
language plpgsql stable set search_path=''
as $$
declare
  v_local timestamp:=timezone('Asia/Seoul',p_now);
  v_monday timestamp;
  v_bid_close timestamp;
  v_battle_start timestamp;
  v_battle_end timestamp;
  v_phase text;
begin
  v_monday:=date_trunc('day',v_local)-((extract(isodow from v_local)::int-1)*interval '1 day');
  v_bid_close:=v_monday+interval '4 days 22 hours';
  v_battle_start:=v_monday+interval '5 days 22 hours';
  v_battle_end:=v_battle_start+interval '30 minutes';
  v_phase:=case when v_local<v_bid_close then 'BIDDING'
                when v_local<v_battle_start then 'LOCKED'
                when v_local<v_battle_end then 'BATTLE'
                else 'SETTLED' end;
  return jsonb_build_object(
    'cycleKey',v_monday::date,
    'phase',v_phase,
    'bidClosesAt',(v_bid_close at time zone 'Asia/Seoul'),
    'battleStartsAt',(v_battle_start at time zone 'Asia/Seoul'),
    'battleEndsAt',(v_battle_end at time zone 'Asia/Seoul'),
    'nextCycleAt',((v_monday+interval '7 days') at time zone 'Asia/Seoul')
  );
end;$$;
revoke all on function private.occupation_window(timestamptz) from public,anon,authenticated;

create or replace function private.occupation_identity(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_save public.game_saves%rowtype;
  v_assoc_id text;
  v_assoc jsonb;
  v_owner_id text;
  v_role text;
  v_key text;
begin
  select * into v_save from public.game_saves where user_id=p_user;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  v_assoc_id:=nullif(v_save.payload->'association'->>'currentId','');
  if v_assoc_id is null then raise exception 'OCCUPATION_ASSOCIATION_REQUIRED';end if;
  select a into v_assoc
  from jsonb_array_elements(coalesce(v_save.payload->'association'->'associations','[]'::jsonb)) a
  where a->>'associationId'=v_assoc_id and a->>'status'='ACTIVE' limit 1;
  if v_assoc is null then raise exception 'OCCUPATION_ASSOCIATION_REQUIRED';end if;
  v_owner_id:=coalesce(v_save.payload->'market'->>'ownerId','local-player');
  select m->>'role' into v_role
  from jsonb_array_elements(coalesce(v_assoc->'members','[]'::jsonb)) m
  where m->>'playerId'=v_owner_id limit 1;
  if v_role is null then raise exception 'OCCUPATION_ASSOCIATION_MEMBER_REQUIRED';end if;

  -- Current association saves are account-local. Prefixing auth uid prevents cross-account spoofing
  -- until association membership becomes server-global.
  v_key:=p_user::text||':'||v_assoc_id;
  return jsonb_build_object(
    'groupKey',v_key,
    'groupName',coalesce(v_assoc->>'name',v_assoc_id),
    'role',v_role,
    'associationId',v_assoc_id
  );
end;$$;
revoke all on function private.occupation_identity(uuid) from public,anon,authenticated;

create or replace function private.occupation_finalize(p_now timestamptz default clock_timestamp())
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_window jsonb:=private.occupation_window(p_now);
  v_cycle date:=(v_window->>'cycleKey')::date;
  v_phase text:=v_window->>'phase';
  v_tower text;
  v_winner private.occupation_bids%rowtype;
  v_bid private.occupation_bids%rowtype;
  v_state private.occupation_tower_state%rowtype;
  v_match private.occupation_matches%rowtype;
  v_attacker_fronts int;
begin
  if v_phase in('LOCKED','BATTLE','SETTLED') then
    for v_tower in select unnest(array['ore','leather','gem','kaleon']::text[]) loop
      if not exists(select 1 from private.occupation_matches where cycle_key=v_cycle and tower=v_tower) then
        select * into v_winner
        from private.occupation_bids
        where cycle_key=v_cycle and tower=v_tower and status='OPEN'
        order by total_merit desc,first_reached_at asc
        limit 1 for update;
        if found then
          update private.occupation_bids set status='WON',updated_at=now() where bid_id=v_winner.bid_id;
          for v_bid in
            select * from private.occupation_bids
            where cycle_key=v_cycle and tower=v_tower and status='OPEN'
            for update
          loop
            update private.occupation_bids set status='LOST',updated_at=now() where bid_id=v_bid.bid_id;
            insert into private.occupation_merit(group_key,group_name,tower,balance,updated_at)
            values(v_bid.group_key,v_bid.group_name,v_tower,floor(v_bid.total_merit*.5)::bigint,now())
            on conflict(group_key,tower) do update set
              balance=private.occupation_merit.balance+excluded.balance,
              group_name=excluded.group_name,
              updated_at=now();
          end loop;
          select * into v_state from private.occupation_tower_state where tower=v_tower for update;
          insert into private.occupation_matches(
            cycle_key,tower,attacker_group_key,attacker_group_name,
            defender_group_key,defender_group_name,status,battle_starts_at,battle_ends_at
          ) values(
            v_cycle,v_tower,v_winner.group_key,v_winner.group_name,
            v_state.owner_group_key,v_state.owner_group_name,
            case when v_phase='BATTLE' then 'ACTIVE' else 'PENDING' end,
            (v_window->>'battleStartsAt')::timestamptz,
            (v_window->>'battleEndsAt')::timestamptz
          ) returning * into v_match;
          insert into private.occupation_front_scores(match_id,front)
          values(v_match.match_id,'LEFT'),(v_match.match_id,'CENTER'),(v_match.match_id,'RIGHT')
          on conflict do nothing;
        end if;
      end if;
    end loop;
  end if;

  if v_phase in('BATTLE','SETTLED') then
    update private.occupation_matches
    set status='ACTIVE',updated_at=now()
    where cycle_key=v_cycle and status='PENDING';
  end if;

  if v_phase='SETTLED' then
    for v_match in
      select * from private.occupation_matches
      where cycle_key=v_cycle and status='ACTIVE'
      for update
    loop
      -- No defender means uncontested capture. Otherwise tied fronts stay with defender.
      if v_match.defender_group_key is null then
        v_attacker_fronts:=3;
      else
        select count(*) into v_attacker_fronts
        from private.occupation_front_scores
        where match_id=v_match.match_id and attacker_wins>defender_wins;
      end if;

      if v_attacker_fronts>=2 then
        update private.occupation_tower_state
        set owner_group_key=v_match.attacker_group_key,
            owner_group_name=v_match.attacker_group_name,
            occupied_at=now(),updated_at=now()
        where tower=v_match.tower;
        update private.occupation_matches
        set status='ATTACKER_WIN',settled_at=now(),updated_at=now()
        where match_id=v_match.match_id;
      else
        update private.occupation_matches
        set status='DEFENDER_WIN',settled_at=now(),updated_at=now()
        where match_id=v_match.match_id;
      end if;
    end loop;
  end if;
end;$$;
revoke all on function private.occupation_finalize(timestamptz) from public,anon,authenticated;

create or replace function public.get_occupation_state(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_identity jsonb;
  v_window jsonb;
  v_group_key text;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.occupation_finalize(clock_timestamp());
  v_window:=private.occupation_window(clock_timestamp());
  begin
    v_identity:=private.occupation_identity(v_user);
    v_group_key:=v_identity->>'groupKey';
  exception when others then
    v_identity:=null;
    v_group_key:=null;
  end;

  return jsonb_build_object(
    'window',v_window,
    'identity',v_identity,
    'towers',coalesce((select jsonb_agg(jsonb_build_object(
      'tower',s.tower,'ownerGroupKey',s.owner_group_key,'ownerGroupName',s.owner_group_name,'occupiedAt',s.occupied_at
    ) order by s.tower) from private.occupation_tower_state s),'[]'::jsonb),
    'merit',coalesce((select jsonb_object_agg(m.tower,m.balance)
      from private.occupation_merit m where m.group_key=v_group_key),'{}'::jsonb),
    'bids',coalesce((select jsonb_agg(jsonb_build_object(
      'tower',b.tower,'groupKey',b.group_key,'groupName',b.group_name,'totalMerit',b.total_merit,
      'firstReachedAt',b.first_reached_at,'lastBidAt',b.last_bid_at,'status',b.status,'mine',b.group_key=v_group_key
    ) order by b.tower,b.total_merit desc,b.first_reached_at asc)
      from private.occupation_bids b where b.cycle_key=(v_window->>'cycleKey')::date),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(jsonb_build_object(
      'matchId',m.match_id,'tower',m.tower,'attackerGroupKey',m.attacker_group_key,'attackerGroupName',m.attacker_group_name,
      'defenderGroupKey',m.defender_group_key,'defenderGroupName',m.defender_group_name,'status',m.status,
      'battleStartsAt',m.battle_starts_at,'battleEndsAt',m.battle_ends_at,
      'fronts',coalesce((select jsonb_agg(jsonb_build_object(
        'front',f.front,'attackerWins',f.attacker_wins,'defenderWins',f.defender_wins
      ) order by case f.front when 'LEFT' then 1 when 'CENTER' then 2 else 3 end)
      from private.occupation_front_scores f where f.match_id=m.match_id),'[]'::jsonb)
    ) order by m.tower)
    from private.occupation_matches m where m.cycle_key=(v_window->>'cycleKey')::date),'[]'::jsonb),
    'duel',(
      select jsonb_build_object(
        'duelId',d.duel_id,'matchId',d.match_id,'front',d.front,'attackerUserId',d.attacker_user_id,
        'defenderUserId',d.defender_user_id,'attackerHp',d.attacker_hp,'defenderHp',d.defender_hp,
        'currentActor',d.current_actor,'actionNonce',d.action_nonce,'status',d.status,
        'winnerSide',d.winner_side,'winnerUserId',d.winner_user_id
      )
      from private.occupation_duels d
      where d.status='ACTIVE' and (d.attacker_user_id=v_user or d.defender_user_id=v_user)
      order by d.created_at desc limit 1
    )
  );
end;$$;
revoke all on function public.get_occupation_state(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_occupation_state(uuid,bigint,text,text) to authenticated;

create or replace function public.donate_occupation_tickets(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_tower text,p_floor integer,p_quantity bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_identity jsonb;
  v_group_key text;
  v_group_name text;
  v_asset private.market_assets%rowtype;
  v_item_id text;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  if p_tower not in('ore','leather','gem','kaleon') or p_floor<1 or p_floor>10 or p_quantity<1 then
    raise exception 'OCCUPATION_DONATION_INVALID';
  end if;
  if exists(select 1 from private.online_expeditions where user_id=v_user and status='ACTIVE') then
    raise exception 'OCCUPATION_EXPEDITION_BLOCKED';
  end if;
  perform private.sync_market_economy_from_latest_save(v_user);
  v_identity:=private.occupation_identity(v_user);
  v_group_key:=v_identity->>'groupKey';v_group_name:=v_identity->>'groupName';
  v_item_id:='ticket:'||p_tower||':'||p_floor::text;
  select * into v_asset from private.market_assets
  where user_id=v_user and item_id=v_item_id for update;
  if not found or v_asset.quantity<p_quantity then raise exception 'OCCUPATION_TICKET_SHORTAGE';end if;
  if v_asset.quantity=p_quantity then delete from private.market_assets where user_id=v_user and item_id=v_item_id;
  else update private.market_assets set quantity=quantity-p_quantity,updated_at=now()
       where user_id=v_user and item_id=v_item_id;end if;

  insert into private.occupation_merit(group_key,group_name,tower,balance,updated_at)
  values(v_group_key,v_group_name,p_tower,p_quantity,now())
  on conflict(group_key,tower) do update set
    balance=private.occupation_merit.balance+excluded.balance,
    group_name=excluded.group_name,
    updated_at=now();

  perform private.persist_market_economy_to_save(v_user);
  return public.get_occupation_state(p_lease_id,p_generation,p_client_instance_id,p_device_id);
end;$$;
revoke all on function public.donate_occupation_tickets(uuid,bigint,text,text,text,integer,bigint) from public,anon;
grant execute on function public.donate_occupation_tickets(uuid,bigint,text,text,text,integer,bigint) to authenticated;

create or replace function public.place_occupation_bid(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_tower text,p_amount bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_identity jsonb;
  v_window jsonb;
  v_cycle date;
  v_group_key text;
  v_group_name text;
  v_role text;
  v_merit private.occupation_merit%rowtype;
  v_bid private.occupation_bids%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.occupation_finalize(clock_timestamp());
  v_window:=private.occupation_window(clock_timestamp());
  if v_window->>'phase'<>'BIDDING' then raise exception 'OCCUPATION_BID_CLOSED';end if;
  if p_tower not in('ore','leather','gem','kaleon') or p_amount<10 or p_amount>100 then
    raise exception 'OCCUPATION_BID_INVALID';
  end if;
  v_identity:=private.occupation_identity(v_user);
  v_group_key:=v_identity->>'groupKey';v_group_name:=v_identity->>'groupName';v_role:=v_identity->>'role';
  if v_role not in('LEADER','OFFICER') then raise exception 'OCCUPATION_BID_PERMISSION';end if;
  if exists(select 1 from private.occupation_tower_state where tower=p_tower and owner_group_key=v_group_key) then
    raise exception 'OCCUPATION_OWNER_CANNOT_BID';
  end if;
  v_cycle:=(v_window->>'cycleKey')::date;

  select * into v_bid from private.occupation_bids
  where cycle_key=v_cycle and group_key=v_group_key for update;
  if found and v_bid.tower<>p_tower then raise exception 'OCCUPATION_BID_ONE_TOWER_ONLY';end if;
  if found and v_bid.last_bid_at+interval '30 minutes'>clock_timestamp() then
    raise exception 'OCCUPATION_BID_COOLDOWN';
  end if;

  select * into v_merit from private.occupation_merit
  where group_key=v_group_key and tower=p_tower for update;
  if not found or v_merit.balance<p_amount then raise exception 'OCCUPATION_MERIT_SHORTAGE';end if;
  update private.occupation_merit set balance=balance-p_amount,updated_at=now()
  where group_key=v_group_key and tower=p_tower;

  if found and v_bid.bid_id is not null then
    update private.occupation_bids
    set total_merit=total_merit+p_amount,first_reached_at=clock_timestamp(),
        last_bid_at=clock_timestamp(),updated_at=now()
    where bid_id=v_bid.bid_id;
  else
    insert into private.occupation_bids(cycle_key,tower,group_key,group_name,total_merit,first_reached_at,last_bid_at)
    values(v_cycle,p_tower,v_group_key,v_group_name,p_amount,clock_timestamp(),clock_timestamp());
  end if;

  return public.get_occupation_state(p_lease_id,p_generation,p_client_instance_id,p_device_id);
end;$$;
revoke all on function public.place_occupation_bid(uuid,bigint,text,text,text,bigint) from public,anon;
grant execute on function public.place_occupation_bid(uuid,bigint,text,text,text,bigint) to authenticated;

create or replace function private.occupation_stats(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_save public.game_saves%rowtype;
  v_payload jsonb;
begin
  select * into v_save from public.game_saves where user_id=p_user;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  v_payload:=private.server_authoritative_payload(p_user,v_save.payload);
  v_payload:=jsonb_set(v_payload,'{expedition}',jsonb_build_object('equipment',v_payload->'equipped'),true);
  return private.combat_equipment_stats(p_user,v_payload);
end;$$;
revoke all on function private.occupation_stats(uuid) from public,anon,authenticated;

create or replace function public.join_occupation_front(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_tower text,p_front text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_identity jsonb;
  v_window jsonb;
  v_group_key text;
  v_match private.occupation_matches%rowtype;
  v_side text;
  v_stats jsonb;
  v_enemy private.occupation_participants%rowtype;
  v_duel private.occupation_duels%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.occupation_finalize(clock_timestamp());
  v_window:=private.occupation_window(clock_timestamp());
  if v_window->>'phase'<>'BATTLE' then raise exception 'OCCUPATION_BATTLE_CLOSED';end if;
  if p_front not in('LEFT','CENTER','RIGHT') then raise exception 'OCCUPATION_FRONT_INVALID';end if;
  v_identity:=private.occupation_identity(v_user);v_group_key:=v_identity->>'groupKey';

  select * into v_match from private.occupation_matches
  where cycle_key=(v_window->>'cycleKey')::date and tower=p_tower and status='ACTIVE'
  for update;
  if not found then raise exception 'OCCUPATION_MATCH_MISSING';end if;
  v_side:=case when v_match.attacker_group_key=v_group_key then 'ATTACKER'
               when v_match.defender_group_key=v_group_key then 'DEFENDER'
               else null end;
  if v_side is null then raise exception 'OCCUPATION_GROUP_NOT_IN_MATCH';end if;

  if exists(select 1 from private.occupation_duels
    where match_id=v_match.match_id and status='ACTIVE'
      and (attacker_user_id=v_user or defender_user_id=v_user)) then
    return public.get_occupation_state(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  end if;

  v_stats:=private.occupation_stats(v_user);
  insert into private.occupation_participants(match_id,user_id,group_key,side,front,combat_stats,status,queued_at,updated_at)
  values(v_match.match_id,v_user,v_group_key,v_side,p_front,v_stats,'QUEUED',clock_timestamp(),now())
  on conflict(match_id,user_id) do update set
    front=excluded.front,combat_stats=excluded.combat_stats,status='QUEUED',
    queued_at=clock_timestamp(),updated_at=now();

  select * into v_enemy from private.occupation_participants
  where match_id=v_match.match_id and front=p_front and side<>v_side and status='QUEUED' and user_id<>v_user
  order by queued_at asc,user_id asc limit 1 for update skip locked;

  if found then
    if v_side='ATTACKER' then
      insert into private.occupation_duels(
        match_id,front,attacker_user_id,defender_user_id,attacker_stats,defender_stats,
        attacker_hp,defender_hp,current_actor
      ) values(
        v_match.match_id,p_front,v_user,v_enemy.user_id,v_stats,v_enemy.combat_stats,
        greatest(1,round((v_stats->>'hp')::numeric)::bigint),
        greatest(1,round((v_enemy.combat_stats->>'hp')::numeric)::bigint),
        v_user
      ) returning * into v_duel;
    else
      insert into private.occupation_duels(
        match_id,front,attacker_user_id,defender_user_id,attacker_stats,defender_stats,
        attacker_hp,defender_hp,current_actor
      ) values(
        v_match.match_id,p_front,v_enemy.user_id,v_user,v_enemy.combat_stats,v_stats,
        greatest(1,round((v_enemy.combat_stats->>'hp')::numeric)::bigint),
        greatest(1,round((v_stats->>'hp')::numeric)::bigint),
        v_enemy.user_id
      ) returning * into v_duel;
    end if;
    update private.occupation_participants set status='DUEL',updated_at=now()
    where match_id=v_match.match_id and user_id in(v_user,v_enemy.user_id);
  end if;

  perform realtime.send(jsonb_build_object('tower',p_tower,'front',p_front),'occupation_changed','occupation',true);
  return public.get_occupation_state(p_lease_id,p_generation,p_client_instance_id,p_device_id);
end;$$;
revoke all on function public.join_occupation_front(uuid,bigint,text,text,text,text) from public,anon;
grant execute on function public.join_occupation_front(uuid,bigint,text,text,text,text) to authenticated;

create or replace function public.apply_occupation_duel_action(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_duel_id uuid,p_action_nonce bigint,p_action text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_duel private.occupation_duels%rowtype;
  v_actor_side text;
  v_attack numeric;
  v_defense numeric;
  v_crit numeric;
  v_damage bigint;
  v_guard boolean;
  v_roll numeric;
  v_winner text;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.occupation_finalize(clock_timestamp());
  select * into v_duel from private.occupation_duels
  where duel_id=p_duel_id for update;
  if not found or v_duel.status<>'ACTIVE' then raise exception 'OCCUPATION_DUEL_NOT_ACTIVE';end if;
  if v_duel.current_actor<>v_user then raise exception 'OCCUPATION_DUEL_NOT_YOUR_TURN';end if;
  if p_action_nonce<>v_duel.action_nonce+1 then raise exception 'OCCUPATION_DUEL_ACTION_SEQUENCE';end if;
  if p_action not in('BASIC','GUARD') then raise exception 'OCCUPATION_DUEL_ACTION_INVALID';end if;

  v_actor_side:=case when v_duel.attacker_user_id=v_user then 'ATTACKER'
                     when v_duel.defender_user_id=v_user then 'DEFENDER'
                     else null end;
  if v_actor_side is null then raise exception 'OCCUPATION_DUEL_NOT_PARTICIPANT';end if;

  if p_action='GUARD' then
    if v_actor_side='ATTACKER' then v_duel.attacker_guard:=true;
    else v_duel.defender_guard:=true;end if;
  else
    if v_actor_side='ATTACKER' then
      v_attack:=coalesce((v_duel.attacker_stats->>'attack')::numeric,1);
      v_defense:=coalesce((v_duel.defender_stats->>'defense')::numeric,0);
      v_crit:=coalesce((v_duel.attacker_stats->>'critChance')::numeric,.05);
      v_guard:=v_duel.defender_guard;v_duel.defender_guard:=false;
    else
      v_attack:=coalesce((v_duel.defender_stats->>'attack')::numeric,1);
      v_defense:=coalesce((v_duel.attacker_stats->>'defense')::numeric,0);
      v_crit:=coalesce((v_duel.defender_stats->>'critChance')::numeric,.05);
      v_guard:=v_duel.attacker_guard;v_duel.attacker_guard:=false;
    end if;
    v_damage:=greatest(1,round(v_attack-greatest(0,v_defense)*.35)::bigint);
    v_roll:=random();
    if v_roll<v_crit then v_damage:=greatest(1,round(v_damage*1.5)::bigint);end if;
    if v_guard then v_damage:=greatest(1,round(v_damage*.6)::bigint);end if;
    if v_actor_side='ATTACKER' then v_duel.defender_hp:=greatest(0,v_duel.defender_hp-v_damage);
    else v_duel.attacker_hp:=greatest(0,v_duel.attacker_hp-v_damage);end if;
  end if;

  v_duel.action_nonce:=p_action_nonce;
  if v_duel.attacker_hp=0 or v_duel.defender_hp=0 then
    v_winner:=case when v_duel.defender_hp=0 then 'ATTACKER' else 'DEFENDER' end;
    update private.occupation_duels set
      attacker_hp=v_duel.attacker_hp,defender_hp=v_duel.defender_hp,
      attacker_guard=v_duel.attacker_guard,defender_guard=v_duel.defender_guard,
      action_nonce=v_duel.action_nonce,status='FINISHED',winner_side=v_winner,
      winner_user_id=case when v_winner='ATTACKER' then v_duel.attacker_user_id else v_duel.defender_user_id end,
      finished_at=now()
    where duel_id=v_duel.duel_id;
    update private.occupation_front_scores set
      attacker_wins=attacker_wins+case when v_winner='ATTACKER' then 1 else 0 end,
      defender_wins=defender_wins+case when v_winner='DEFENDER' then 1 else 0 end,
      updated_at=now()
    where match_id=v_duel.match_id and front=v_duel.front;
    update private.occupation_participants set status='READY',updated_at=now()
    where match_id=v_duel.match_id and user_id in(v_duel.attacker_user_id,v_duel.defender_user_id);
  else
    update private.occupation_duels set
      attacker_hp=v_duel.attacker_hp,defender_hp=v_duel.defender_hp,
      attacker_guard=v_duel.attacker_guard,defender_guard=v_duel.defender_guard,
      action_nonce=v_duel.action_nonce,
      current_actor=case when v_actor_side='ATTACKER' then v_duel.defender_user_id else v_duel.attacker_user_id end
    where duel_id=v_duel.duel_id;
  end if;

  perform realtime.send(jsonb_build_object('duelId',p_duel_id),'occupation_changed','occupation',true);
  return public.get_occupation_state(p_lease_id,p_generation,p_client_instance_id,p_device_id);
end;$$;
revoke all on function public.apply_occupation_duel_action(uuid,bigint,text,text,uuid,bigint,text) from public,anon;
grant execute on function public.apply_occupation_duel_action(uuid,bigint,text,text,uuid,bigint,text) to authenticated;
