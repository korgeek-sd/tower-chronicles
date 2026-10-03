create schema private;
create role anon;create role authenticated;
create table private.online_combat_states(
user_id uuid,
run_id uuid,
encounter_index int8 default 1,
monster_id text,
player_hp int8,
player_max_hp int8,
monster_hp int8,
monster_max_hp int8,
monster_attack numeric,
monster_defense numeric,
turn_no int8 default 1,
phase text default 'PLAYER_TURN'::text,
action_nonce int8 default 0,
updated_at timestamptz default now(),
player_attack numeric default 1,
player_defense numeric default 0,
potion_lesser int4 default 0,
potion_standard int4 default 0,
potion_greater int4 default 0,
potion_supreme int4 default 0,
cooldowns jsonb default '{}'::jsonb,
rng_seed int8 default 0,
crit_chance numeric default 0.05,
crit_damage numeric default 1.5,
basic_hits int4 default 1,
skill_power numeric default 1,
guard_turns int4 default 0,
revival_count int4 default 0,
pending_revival bool default false,
accessory_passive text,
accessory_value numeric default 0,
player_effects jsonb default '[]'::jsonb,
monster_effects jsonb default '[]'::jsonb,
player_shield numeric default 0,
monster_shield numeric default 0,
monster_cooldowns jsonb default '{}'::jsonb,
monster_prepared_action text,
job_id text,
job_resource numeric default 0,
job_flags jsonb default '{}'::jsonb,
state_version int8 default 1,
player_turn int8 default 1,
monster_turn int8 default 0,
player_shield_hits int4 default 0,
monster_shield_hits int4 default 0,
monster_reactive_action text,
return_authorized bool default false
);
create table private.online_expeditions(
user_id uuid,
run_id uuid default gen_random_uuid(),
tower text,
floor int4,
status text,
starting_revision int8,
revenue_share_rate int4 default 0,
started_at timestamptz default now(),
settled_at timestamptz,
encounter_index int8 default 0,
boss_progress int4 default 0,
boss_defeated bool default false,
pending_event jsonb,
temporary_loot jsonb default '{"silver": 0, "tickets": 0, "material": 0}'::jsonb,
run_version int8 default 1,
recent_event_ids _text default '{}'::text[],
potion_lesser int4,
potion_standard int4,
potion_greater int4,
potion_supreme int4,
revival_count int4,
stronghold jsonb,
stronghold_sequence int8 default 0,
confirmed_kills int8 default 0,
reward_seed int8 default (floor((random() * (2147483647)::double precision)))::bigint,
last_confirmed_kill_at timestamptz,
equipment_snapshot jsonb,
job_snapshot_id text,
association_id uuid
);

create table private.online_expedition_kills(user_id uuid,run_id uuid,kill_index bigint,monster_id text,primary key(user_id,run_id,kill_index));
create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language sql as $$ select $1 $$;
create function private.server_boss_id(text,int) returns text language sql as $$ select 'boss' $$;
create function private.server_kill_loot(private.online_expeditions,bigint) returns jsonb language sql as $$ select '{"silver":5,"material":0,"tickets":0}'::jsonb $$;
create function private.ensure_run_consumables(uuid,private.online_expeditions) returns private.online_expeditions language sql as $$ select $2 $$;
create function private.persist_run_bag_to_save(uuid,private.online_expeditions) returns void language sql as $$ select $$;

create table public.game_saves(user_id uuid,payload jsonb);

create function private.server_run_enhancement_stones(private.online_expeditions) returns bigint language sql as $$ select 0::bigint $$;
