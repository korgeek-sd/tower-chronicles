create role anon;create role authenticated;create schema private;create schema auth;
create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid);
create function auth.uid() returns uuid language sql as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
create table private.active_game_sessions(user_id uuid primary key,lease_id uuid,generation bigint,client_instance_id text,device_id text,expires_at timestamptz,auth_session_id uuid);
create table private.premium_accounts(user_id uuid primary key,expires_at timestamptz);
create table public.game_saves(user_id uuid primary key,revision bigint default 1,payload jsonb default '{"expedition":null,"silver":0,"market":{"gold":0},"tickets":{}}');
create table private.player_wallets(user_id uuid primary key,silver bigint not null check(silver>=0),gold bigint default 0,updated_at timestamptz default now());
create table private.market_assets(user_id uuid,item_id text,quantity bigint not null check(quantity>=0),gear jsonb,updated_at timestamptz default now(),primary key(user_id,item_id));
create table private.online_expeditions(user_id uuid,status text);
create function private.premium_active(u uuid) returns boolean language sql as $$select exists(select 1 from private.premium_accounts where user_id=u and expires_at>now())$$;
create function private.village_life_user(l uuid,g bigint,c text,d text) returns uuid language plpgsql as $$begin
 if auth.uid() is null or not exists(select 1 from private.active_game_sessions a join auth.sessions s on s.id=a.auth_session_id and s.user_id=a.user_id where a.user_id=auth.uid() and a.lease_id=l and a.generation=g and a.client_instance_id=c and a.device_id=d and a.expires_at>now()) then raise exception 'GAME_SESSION_LOST';end if;return auth.uid();end$$;
create function private.sync_market_economy_from_latest_save(u uuid) returns void language sql as $$select$$;
create function private.persist_market_economy_to_save(u uuid) returns void language plpgsql as $$begin
 if current_setting('test.persist_failure',true)='on' then raise exception 'TEST_PERSIST_FAILURE';end if;
 update public.game_saves set revision=revision+1,payload=payload||jsonb_build_object('silver',(select silver from private.player_wallets where user_id=u),'ticketAssets',coalesce((select jsonb_object_agg(item_id,quantity) from private.market_assets where user_id=u),'{}'::jsonb)) where user_id=u;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
end$$;
create function private.cloud_record_json(u uuid) returns jsonb language sql as $$select jsonb_build_object('revision',revision,'payload',payload) from public.game_saves where user_id=u$$;

create function public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text) returns void language plpgsql as $$
begin
 return;
end $$;
