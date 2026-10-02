-- Isolated fixture for existing auth/lease/save/economy interfaces.
-- Coupon RPCs and mail claim implementation are loaded unchanged from migrations.
create role anon;
create role authenticated;
create schema auth;
create schema private;
grant usage on schema public,auth,private to authenticated;
create table auth.users(id uuid primary key,raw_app_meta_data jsonb default '{}');
create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz,updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create table private.active_game_sessions(user_id uuid primary key,lease_id uuid,auth_session_id uuid,device_id text,client_instance_id text,platform text,app_version text,generation bigint,acquired_at timestamptz,heartbeat_at timestamptz,expires_at timestamptz);
create table public.game_saves(user_id uuid primary key,revision bigint,save_schema integer,app_version text,payload jsonb,payload_hash text);
create table private.player_wallets(user_id uuid primary key,silver bigint default 0,gold bigint default 0,updated_at timestamptz default now());
create table private.market_assets(user_id uuid,item_id text,quantity bigint,gear jsonb,updated_at timestamptz default now(),primary key(user_id,item_id));
create table private.online_expeditions(user_id uuid,status text);
create function private.server_bootstrap_payload(jsonb) returns jsonb language sql as $$select '{"expedition":null,"market":{"gold":0}}'::jsonb$$;
create function private.sync_market_economy_from_latest_save(u uuid) returns void language sql as $$
 insert into private.player_wallets(user_id,silver,gold) select user_id,(payload->>'silver')::bigint,(payload->'market'->>'gold')::bigint from public.game_saves where user_id=u on conflict(user_id) do nothing;
$$;
create function private.require_active_game_session(l uuid,g bigint,c text,d text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.active_game_sessions where user_id=auth.uid() and lease_id=l and generation=g and client_instance_id=c and device_id=d and expires_at>now()) then raise exception 'GAME_SESSION_LOST';end if;
 return auth.uid();
end $$;
create function private.persist_market_economy_to_save(u uuid) returns void language sql as $$
 update public.game_saves set revision=revision+1,payload=payload||jsonb_build_object('silver',(select silver from private.player_wallets where user_id=u),'market',jsonb_build_object('gold',(select gold from private.player_wallets where user_id=u)),'lootItems',coalesce((select jsonb_object_agg(substr(item_id,7),quantity) from private.market_assets where user_id=u and item_id like 'other:%'),'{}'::jsonb)) where user_id=u;
$$;
create function private.market_state_json(u uuid) returns jsonb language sql as $$
 select jsonb_build_object('wallet',(select jsonb_build_object('silver',silver,'gold',gold) from private.player_wallets where user_id=u),'assets',coalesce((select jsonb_agg(jsonb_build_object('itemId',item_id,'quantity',quantity)) from private.market_assets where user_id=u),'[]'::jsonb));
$$;

