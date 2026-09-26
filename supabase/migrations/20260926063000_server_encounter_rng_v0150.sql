-- v0.1.50 server-selected encounters and deterministic critical RNG.
alter table private.online_combat_states
 add column if not exists rng_seed bigint not null default 0,
 add column if not exists crit_chance numeric not null default .05,
 add column if not exists crit_damage numeric not null default 1.5,
 add column if not exists basic_hits integer not null default 1;

create or replace function private.server_monster_profile(p_tower text,p_floor integer,p_seed bigint,p_encounter bigint)
returns jsonb language plpgsql immutable set search_path=''
as $$
declare ids text[];hps numeric[];atks numeric[];idx int;id text;hp_mult numeric:=1;atk_mult numeric:=1;
begin
 if p_tower='ore' then ids:=array['goblin_miner','cave_rat','mine_bat','goblin_carrier','goblin_overseer'];hps:=array[1,.72,.8,1.05,1.25];atks:=array[1,.78,.9,.95,1.18];
 elsif p_tower='leather' then ids:=array['wasteland_boar','thorn_jackal','carrion_vulture','hide_gnawer','pack_vanguard'];hps:=array[1,.72,.78,1.05,1.25];atks:=array[1,.78,.88,.95,1.18];
 elsif p_tower='kaleon' then ids:=array['moss_spirit','spore_hound','graft_stag','blight_leech','receptor_aberrant'];hps:=array[1.08,.82,1.2,.94,1.3];atks:=array[.86,1.08,1.05,.92,1.18];
 else
  ids:=array['quartz_carapace_beetle','glassjaw_stalker','refractive_scale_lizard','echo_crystal','vein_clinger','crystal_needle_centipede','whiteglow_burrower','clouded_crystal_beast','translucent_bat','shardback_spider','crystalhorn_goat','lens_eye_watcher','hardening_slime','crystal_scale_serpent','vein_hound','shatter_mole','quartz_spine_predator','fracture_claw_hunter','whitevein_leech','celestial_crystal_brute'];
  hps:=array[1.18,.88,.82,1,.94,.78,1.08,1.2,.72,.8,1.06,.9,1.15,.96,.9,1.14,1.12,1.02,1.08,1.35];atks:=array[.9,1.18,.9,1,.82,.92,1.08,.95,.88,.96,1.14,1.02,.82,1.12,1.2,1.1,1.2,1.24,.94,1.24];
  if p_floor=1 then ids:=ids[1:5];hps:=hps[1:5];atks:=atks[1:5];
  elsif p_floor=2 then ids:=ids[1:7];hps:=hps[1:7];atks:=atks[1:7];
  elsif p_floor=3 then ids:=ids[1:10];hps:=hps[1:10];atks:=atks[1:10];
  elsif p_floor=4 then ids:=ids[1:12];hps:=hps[1:12];atks:=atks[1:12];
  elsif p_floor=5 then ids:=ids[1:14];hps:=hps[1:14];atks:=atks[1:14];
  elsif p_floor=6 then ids:=ids[5:15];hps:=hps[5:15];atks:=atks[5:15];
  elsif p_floor=7 then ids:=ids[7:17];hps:=hps[7:17];atks:=atks[7:17];
  elsif p_floor=8 then ids:=ids[9:19];hps:=hps[9:19];atks:=atks[9:19];
  elsif p_floor=9 then ids:=ids[10:20];hps:=hps[10:20];atks:=atks[10:20];
  else ids:=ids[11:20];hps:=hps[11:20];atks:=atks[11:20];end if;
 end if;
 idx:=1+mod(abs(hashtextextended(p_seed::text||':'||p_encounter::text,0)),array_length(ids,1));
 id:=ids[idx];hp_mult:=hps[idx];atk_mult:=atks[idx];
 return jsonb_build_object('id',id,'hpMultiplier',hp_mult,'attackMultiplier',atk_mult);
end $$;
revoke all on function private.server_monster_profile(text,integer,bigint,bigint) from public,anon,authenticated;

create or replace function private.server_roll(p_seed bigint,p_encounter bigint,p_nonce bigint,p_hit int)
returns numeric language sql immutable set search_path='' as $$
 select (abs(hashtextextended(p_seed::text||':'||p_encounter::text||':'||p_nonce::text||':'||p_hit::text,0))%1000000)::numeric/1000000
$$;
revoke all on function private.server_roll(bigint,bigint,bigint,int) from public,anon,authenticated;

-- Replace initialization: monster identity/stats are selected by the server.
create or replace function public.begin_online_combat_state(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_monster_id text default null,p_player_hp bigint default null,p_player_max_hp bigint default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_save public.game_saves%rowtype;v_stats jsonb;v_existing private.online_combat_states%rowtype;v_bag jsonb;v_profile jsonb;v_enc bigint;v_hp bigint;v_atk numeric;v_weapon text;v_crit numeric;v_hits int;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 select * into v_save from public.game_saves where user_id=v_user for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into v_existing from private.online_combat_states where user_id=v_user for update;
 if found and v_existing.run_id=v_run.run_id and v_existing.phase not in('DEFEATED','PLAYER_DEAD') then return jsonb_build_object('encounterIndex',v_existing.encounter_index,'monsterId',v_existing.monster_id,'playerHp',v_existing.player_hp,'playerMaxHp',v_existing.player_max_hp,'monsterHp',v_existing.monster_hp,'monsterMaxHp',v_existing.monster_max_hp,'turn',v_existing.turn_no,'phase',v_existing.phase,'actionNonce',v_existing.action_nonce);end if;
 v_stats:=private.combat_equipment_stats(v_user,v_save.payload);v_bag:=coalesce(v_save.payload->'expedition'->'bag','{}'::jsonb);v_enc:=coalesce(v_existing.encounter_index,0)+1;
 v_profile:=private.server_monster_profile(v_run.tower,v_run.floor,v_run.reward_seed,v_enc);v_hp:=round(private.server_monster_hp(v_run.floor)*(v_profile->>'hpMultiplier')::numeric);v_atk:=private.server_monster_attack(v_run.floor)*(v_profile->>'attackMultiplier')::numeric;
 v_weapon:=v_stats->>'weapon';v_crit:=case v_weapon when 'dagger' then .2 else .05 end;v_hits:=case when v_weapon='bow' then 2 else 1 end;
 insert into private.online_combat_states(user_id,run_id,encounter_index,monster_id,player_hp,player_max_hp,player_attack,player_defense,monster_hp,monster_max_hp,monster_attack,monster_defense,turn_no,phase,action_nonce,potion_lesser,potion_standard,potion_greater,potion_supreme,cooldowns,rng_seed,crit_chance,crit_damage,basic_hits,updated_at)
 values(v_user,v_run.run_id,v_enc,v_profile->>'id',(v_stats->>'hp')::bigint,(v_stats->>'hp')::bigint,(v_stats->>'attack')::numeric,(v_stats->>'defense')::numeric,v_hp,v_hp,v_atk,private.server_monster_defense(v_run.floor),1,'PLAYER_TURN',0,coalesce((v_bag->>'healing_lesser')::int,0),coalesce((v_bag->>'healing_standard')::int,0),coalesce((v_bag->>'healing_greater')::int,0),coalesce((v_bag->>'healing_supreme')::int,0),'{}',v_run.reward_seed,v_crit,1.5,v_hits,now())
 on conflict(user_id) do update set run_id=excluded.run_id,encounter_index=excluded.encounter_index,monster_id=excluded.monster_id,player_hp=excluded.player_hp,player_max_hp=excluded.player_max_hp,player_attack=excluded.player_attack,player_defense=excluded.player_defense,monster_hp=excluded.monster_hp,monster_max_hp=excluded.monster_max_hp,monster_attack=excluded.monster_attack,monster_defense=excluded.monster_defense,turn_no=1,phase='PLAYER_TURN',action_nonce=0,potion_lesser=excluded.potion_lesser,potion_standard=excluded.potion_standard,potion_greater=excluded.potion_greater,potion_supreme=excluded.potion_supreme,cooldowns='{}',rng_seed=excluded.rng_seed,crit_chance=excluded.crit_chance,crit_damage=excluded.crit_damage,basic_hits=excluded.basic_hits,updated_at=now();
 return jsonb_build_object('encounterIndex',v_enc,'monsterId',v_profile->>'id','playerHp',(v_stats->>'hp')::bigint,'playerMaxHp',(v_stats->>'hp')::bigint,'monsterHp',v_hp,'monsterMaxHp',v_hp,'turn',1,'phase','PLAYER_TURN','actionNonce',0);
end $$;

create or replace function public.apply_online_basic_attack(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_attack numeric default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_combat private.online_combat_states%rowtype;v_damage bigint:=0;v_hit int;v_mult numeric;v_crit boolean;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into v_run from private.online_expeditions where user_id=v_user for update;select * into v_combat from private.online_combat_states where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' or v_combat.run_id<>v_run.run_id then raise exception 'COMBAT_SERVER_STATE_MISSING';end if;if v_combat.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>v_combat.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 for v_hit in 1..v_combat.basic_hits loop
  v_mult:=case when v_combat.basic_hits=2 then .55 else 1 end;v_crit:=private.server_roll(v_combat.rng_seed,v_combat.encounter_index,p_action_nonce,v_hit)<v_combat.crit_chance;
  v_damage:=v_damage+greatest(1,round(v_combat.player_attack*v_mult*(case when v_crit then v_combat.crit_damage else 1 end)-v_combat.monster_defense)::bigint);
 end loop;
 return private.finish_server_player_action(v_user,v_run,v_combat,p_action_nonce,v_damage);
end $$;
