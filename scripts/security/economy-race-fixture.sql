-- Isolated PostgreSQL fixture: copied critical live functions are loaded separately.
-- Leaf adapters below deliberately replace Auth transport, save JSON formatting,
-- premium lookup, response formatting and Realtime delivery. They are NOT a full Supabase schema.
create schema auth; create schema private; create schema realtime;
create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
create table auth.users(id uuid primary key);
create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
create table private.active_game_sessions(user_id uuid primary key,lease_id uuid,generation bigint,auth_session_id uuid,device_id text,client_instance_id text,expires_at timestamptz);
create table public.game_saves(user_id uuid primary key,revision bigint default 1,payload jsonb default '{"expedition":null,"equipped":{}}');
create table private.player_wallets(user_id uuid primary key,silver bigint not null check(silver>=0),gold bigint not null default 0 check(gold>=0),last_synced_revision bigint default 1,updated_at timestamptz default now());
create table private.market_assets(user_id uuid,item_id text,quantity bigint not null check(quantity>=0),gear jsonb,updated_at timestamptz default now(),primary key(user_id,item_id));
create table private.online_expeditions(user_id uuid,status text);
create table private.market_orders(order_id uuid primary key default gen_random_uuid(),user_id uuid,item_id text,side text check(side in('BUY','SELL')),limit_price bigint,original_quantity bigint,remaining_quantity bigint check(remaining_quantity>=0),status text,gear jsonb,escrow_gear jsonb default '[]',created_at timestamptz default now(),updated_at timestamptz default now(),expires_at timestamptz default now()+interval '30 days');
create table private.market_trades(trade_id uuid primary key default gen_random_uuid(),item_id text,price bigint,quantity bigint,buy_order_id uuid,sell_order_id uuid,buyer_id uuid,seller_id uuid,seller_fee_silver bigint default 0,executed_at timestamptz default now());
create table private.game_mail(mail_id uuid primary key default gen_random_uuid(),user_id uuid,event_key text,category text,title text,details jsonb,attachment_item_id text,attachment_quantity bigint,attachment_gear jsonb,attachment_assets jsonb default '[]',claimed_at timestamptz,unique(user_id,event_key));
create table private.server_banks(id uuid primary key default gen_random_uuid(),owner_id uuid unique,name text,rate integer,durations integer[],vault bigint check(vault>=0),created_at timestamptz default now());
create table private.server_bank_loans(id uuid primary key default gen_random_uuid(),bank_id uuid,borrower_id uuid,ticket_id text,tickets bigint,principal bigint,interest bigint,rate integer,duration integer,issued_at timestamptz,maturity_at timestamptz,grace_at timestamptz,status text default 'ACTIVE',reminders integer default 0,settled_at timestamptz);
create table private.server_bank_requests(user_id uuid,request_id uuid,action text,params jsonb,result jsonb,created_at timestamptz default now(),primary key(user_id,request_id));
create table private.server_bank_ledger(id bigint generated always as identity primary key,user_id uuid,bank_id uuid,loan_id uuid,kind text,wallet_delta bigint default 0,vault_delta bigint default 0,ticket_id text,ticket_delta bigint default 0,created_at timestamptz default now());
create table private.server_bank_profiles(user_id uuid primary key,penalty_until timestamptz);
create table private.server_bank_collateral(bank_id uuid,ticket_id text,quantity bigint check(quantity>=0),primary key(bank_id,ticket_id));
create function private.sync_market_economy_from_latest_save(uuid) returns void language sql as $$select$$;
create function private.premium_active(uuid) returns boolean language sql as $$select false$$;
create function private.premium_fee_bps(uuid) returns integer language sql as $$select 250$$;
create function private.village_life_user(uuid,bigint,text,text) returns uuid language plpgsql as $$begin return private.require_active_game_session($1,$2,$3,$4);end$$;
create function private.market_state_json(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
create function private.server_bank_state(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
create function private.cloud_record_json(uuid) returns jsonb language sql as $$select jsonb_build_object('revision',revision,'payload',payload) from public.game_saves where user_id=$1$$;
create function private.persist_market_economy_to_save(uuid) returns bigint language plpgsql as $$declare r bigint;begin
 if current_setting('test.persist_failure',true)='on' then raise exception 'TEST_PERSIST_FAILURE';end if;
 perform 1 from public.game_saves where user_id=$1 for update;
 update public.game_saves set revision=revision+1,payload=payload||jsonb_build_object('silver',(select silver from private.player_wallets where user_id=$1)) where user_id=$1 returning revision into r;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;return r;
end$$;
create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;
