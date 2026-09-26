-- v0.1.49 resource optimization:
-- 1) do not broadcast routine lease heartbeats,
-- 2) make unchanged server-economy reads write-free,
-- 3) remove the no-longer-used game_saves Postgres Changes publication.

create or replace function private.broadcast_game_session_signal()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_should_broadcast boolean := false;
begin
  if tg_op='INSERT' then
    v_should_broadcast:=true;
  else
    v_should_broadcast:=
      new.generation is distinct from old.generation
      or new.auth_session_id is distinct from old.auth_session_id
      or new.device_id is distinct from old.device_id
      or new.client_instance_id is distinct from old.client_instance_id
      or new.takeover_requested_at is distinct from old.takeover_requested_at
      or new.takeover_by_auth_session_id is distinct from old.takeover_by_auth_session_id
      or new.takeover_by_device_id is distinct from old.takeover_by_device_id
      or new.takeover_by_client_instance_id is distinct from old.takeover_by_client_instance_id
      or (old.expires_at>statement_timestamp() and new.expires_at<=statement_timestamp());
  end if;

  if v_should_broadcast then
    perform realtime.send(
      jsonb_build_object(
        'generation',new.generation,
        'platform',new.platform,
        'heartbeat_at',new.heartbeat_at,
        'expires_at',new.expires_at,
        'takeover_requested_at',new.takeover_requested_at
      ),
      'session_changed',
      'game-session:'||new.user_id::text,
      true
    );
  end if;
  return new;
end;
$$;

create or replace function private.sync_market_economy_from_latest_save(p_user uuid)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_revision bigint;
  v_payload jsonb;
  v_last bigint;
begin
  select revision,payload into v_revision,v_payload
  from public.game_saves
  where user_id=p_user;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;

  select last_synced_revision into v_last
  from private.player_wallets
  where user_id=p_user;

  if found then
    if v_last>=v_revision then return v_revision; end if;
    update private.player_wallets
    set last_synced_revision=v_revision,updated_at=now()
    where user_id=p_user;
    return v_revision;
  end if;

  insert into private.player_wallets(user_id,silver,gold,last_synced_revision,updated_at)
  values(
    p_user,
    greatest(0,coalesce((v_payload->>'silver')::bigint,0)),
    greatest(0,coalesce((v_payload->'market'->>'gold')::bigint,0)),
    v_revision,
    now()
  );

  insert into private.market_assets(user_id,item_id,quantity,gear)
  select p_user,'gear:'||(g->>'id'),1,g
  from jsonb_array_elements(coalesce(v_payload->'items','[]'::jsonb)) g
  where nullif(g->>'id','') is not null;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'material:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'ticket:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'skillbook:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'skillBooks','{}'::jsonb)) kv
  where (kv.value)::bigint>0;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'other:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'lootItems','{}'::jsonb)) kv
  where (kv.value)::bigint>0;

  return v_revision;
end;
$$;

do $$
begin
  if exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='game_saves'
  ) then
    alter publication supabase_realtime drop table public.game_saves;
  end if;
end $$;
