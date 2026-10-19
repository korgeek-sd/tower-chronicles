create schema private;create schema auth;create role anon;create role authenticated;
create table auth.users(id uuid primary key);
create table private.online_associations(association_id uuid primary key,leader_user_id uuid,status text,name text);
create table private.online_association_members(association_id uuid,user_id uuid primary key,role text);
create table private.village_life_towns(id text primary key,name text,x int,y int);
create table private.village_war_owners(town_id text,association_id uuid);
create table private.village_life_players(user_id uuid primary key,materials jsonb,products jsonb);
create table public.game_player_profiles(user_id uuid primary key,nickname text);
create table public.game_saves(user_id uuid primary key,payload jsonb);
create table private.online_expeditions(user_id uuid,status text);
create table private.guild_auction_listings(
 listing_id uuid primary key default gen_random_uuid(),association_id uuid,source text,gear jsonb,
 starting_bid bigint,top_user_id uuid,top_bid bigint default 0,claimed_at timestamptz,
 cancelled_at timestamptz,returned_at timestamptz,started_at timestamptz,ends_at timestamptz
);
create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language sql as $$select $1$$;
create function private.refresh_village_life(uuid) returns void language plpgsql as $$begin end$$;
create function private.association_activity(uuid,uuid,text,text) returns void language plpgsql as $$begin end$$;
create function private.guild_auction_state_json(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
