-- v0.1.51 final trust-boundary hardening for expedition equipment snapshots.

alter table private.online_expeditions
 add column if not exists equipment_snapshot jsonb,
 add column if not exists job_snapshot_id text;

create or replace function private.server_equipment_snapshot(p_user uuid,p_equipped jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare w jsonb;a jsonb;b jsonb;x jsonb;
begin
 select gear into w from private.market_assets
 where user_id=p_user and item_id='gear:'||coalesce(p_equipped->>'weapon','') and quantity=1
   and gear is not null and gear->>'kind' in('sword','dagger','bow','staff') limit 1;
 if w is null then
   select gear into w from private.market_assets
   where user_id=p_user and item_id='gear:starter' and quantity=1
     and gear is not null and gear->>'kind'='sword' limit 1;
 end if;
 select gear into a from private.market_assets
 where user_id=p_user and item_id='gear:'||coalesce(p_equipped->>'armor','') and quantity=1
   and gear is not null and gear->>'kind'='armor' limit 1;
 select gear into b from private.market_assets
 where user_id=p_user and item_id='gear:'||coalesce(p_equipped->>'boots','') and quantity=1
   and gear is not null and gear->>'kind'='boots' limit 1;
 select gear into x from private.market_assets
 where user_id=p_user and item_id='gear:'||coalesce(p_equipped->>'accessory','') and quantity=1
   and gear is not null and gear->>'kind' in('vampire','unyielding','berserker') limit 1;
 return jsonb_build_object(
   'weapon',case when w is null then null else w->>'id' end,
   'armor',case when a is null then null else a->>'id' end,
   'boots',case when b is null then null else b->>'id' end,
   'accessory',case when x is null then null else x->>'id' end
 );
end $$;
revoke all on function private.server_equipment_snapshot(uuid,jsonb) from public,anon,authenticated;

create or replace function private.combat_equipment_stats(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_eq jsonb:=p_payload->'expedition'->'equipment';
 v_items jsonb:=coalesce(p_payload->'items','[]'::jsonb);
 v_weapon jsonb;v_armor jsonb;v_boots jsonb;
 v_kind text:='sword';v_mult numeric:=1;v_scale numeric:=.55;
 v_attack numeric:=8;v_def numeric:=3;v_hp numeric:=180;
begin
 select i into v_weapon from jsonb_array_elements(v_items)i
  where i->>'id'=v_eq->>'weapon' and i->>'kind' in('sword','dagger','bow','staff') limit 1;
 select i into v_armor from jsonb_array_elements(v_items)i
  where i->>'id'=v_eq->>'armor' and i->>'kind'='armor' limit 1;
 select i into v_boots from jsonb_array_elements(v_items)i
  where i->>'id'=v_eq->>'boots' and i->>'kind'='boots' limit 1;

 if v_weapon is not null then
   v_kind:=v_weapon->>'kind';
   v_mult:=1+greatest(0,least(3,coalesce((v_weapon->>'enhancement')::int,0)))*0.1;
   v_scale:=case when v_weapon->>'id'='starter' then .55
     else greatest(1,least(5,coalesce((v_weapon->>'tier')::int,1))) end;
 end if;

 v_attack:=v_attack+(case v_kind when 'sword' then 10 when 'dagger' then 7 when 'bow' then 12 else 6 end)*v_scale*v_mult;
 v_def:=v_def+(case v_kind when 'sword' then 4 when 'bow' then 1 else 0 end)*v_scale*v_mult;

 if v_armor is not null then
   v_mult:=1+greatest(0,least(3,coalesce((v_armor->>'enhancement')::int,0)))*0.1;
   v_hp:=v_hp+55*greatest(1,least(5,coalesce((v_armor->>'tier')::int,1)))*v_mult;
   v_def:=v_def+7*greatest(1,least(5,coalesce((v_armor->>'tier')::int,1)))*v_mult;
 end if;
 if v_boots is not null then
   v_mult:=1+greatest(0,least(3,coalesce((v_boots->>'enhancement')::int,0)))*0.1;
   v_hp:=v_hp+15*greatest(1,least(5,coalesce((v_boots->>'tier')::int,1)))*v_mult;
 end if;
 return jsonb_build_object('attack',v_attack,'defense',v_def,'hp',round(v_hp),'weapon',v_kind);
end $$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;

update private.online_expeditions r
set equipment_snapshot=private.server_equipment_snapshot(r.user_id,coalesce(g.payload->'expedition'->'equipment',g.payload->'equipped')),
    job_snapshot_id=private.server_current_job(r.user_id)
from public.game_saves g
where g.user_id=r.user_id and r.status='ACTIVE' and r.equipment_snapshot is null;

create or replace function public.start_online_expedition(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_tower text,p_floor integer,p_client_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid;v_save public.game_saves%rowtype;v_ticket_id text;v_ticket private.market_assets%rowtype;
  v_rate integer:=0;v_assoc_id text;v_exp jsonb;v_payload jsonb;r private.online_expeditions%rowtype;
  job_id text;bag jsonb;equipment jsonb;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  if p_tower not in ('ore','leather','gem','kaleon') or p_floor<1 or p_floor>10 then raise exception 'EXPEDITION_TARGET_INVALID';end if;
  select * into v_save from public.game_saves where user_id=v_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  if jsonb_typeof(v_save.payload->'expedition') is not null and jsonb_typeof(v_save.payload->'expedition')<>'null' then raise exception 'EXPEDITION_ALREADY_ACTIVE';end if;
  if exists(select 1 from private.online_expeditions where user_id=v_user and status='ACTIVE') then raise exception 'EXPEDITION_ALREADY_ACTIVE';end if;

  v_ticket_id:='ticket:'||p_tower||':'||p_floor::text;
  select * into v_ticket from private.market_assets where user_id=v_user and item_id=v_ticket_id for update;
  if not found or v_ticket.quantity<1 then raise exception 'EXPEDITION_TICKET_REQUIRED';end if;
  if v_ticket.quantity=1 then delete from private.market_assets where user_id=v_user and item_id=v_ticket_id;
  else update private.market_assets set quantity=quantity-1,updated_at=now() where user_id=v_user and item_id=v_ticket_id;end if;

  v_assoc_id:=v_save.payload->'association'->>'currentId';
  if v_assoc_id is not null then
    select greatest(0,least(30,coalesce((a->>'revenueShareRatePercent')::integer,0))) into v_rate
    from jsonb_array_elements(coalesce(v_save.payload->'association'->'associations','[]'::jsonb)) a
    where a->>'associationId'=v_assoc_id and a->>'status'='ACTIVE' limit 1;
    v_rate:=coalesce(v_rate,0);
  end if;

  equipment:=private.server_equipment_snapshot(v_user,v_save.payload->'equipped');
  job_id:=private.server_current_job(v_user);

  insert into private.online_expeditions(
    user_id,run_id,tower,floor,status,starting_revision,revenue_share_rate,started_at,settled_at,equipment_snapshot,job_snapshot_id
  )
  values(v_user,gen_random_uuid(),p_tower,p_floor,'ACTIVE',v_save.revision,v_rate,now(),null,equipment,job_id)
  on conflict(user_id) do update set
    run_id=excluded.run_id,tower=excluded.tower,floor=excluded.floor,status='ACTIVE',
    starting_revision=excluded.starting_revision,revenue_share_rate=excluded.revenue_share_rate,
    started_at=excluded.started_at,settled_at=null,encounter_index=0,boss_progress=0,boss_defeated=false,
    pending_event=null,temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,run_version=1,
    recent_event_ids='{}'::text[],potion_lesser=null,potion_standard=null,potion_greater=null,potion_supreme=null,
    revival_count=null,stronghold=null,stronghold_sequence=0,confirmed_kills=0,
    reward_seed=floor(random()*2147483647)::bigint,last_confirmed_kill_at=null,
    equipment_snapshot=excluded.equipment_snapshot,job_snapshot_id=excluded.job_snapshot_id
  returning * into r;

  v_payload:=private.server_authoritative_payload(v_user,p_client_payload);
  v_exp:=coalesce(v_payload->'expedition','{}'::jsonb)||jsonb_build_object(
    'tower',p_tower,'floor',p_floor,'equipment',equipment,'jobSnapshotId',job_id
  );
  v_payload:=jsonb_set(v_payload,'{expedition}',v_exp,true);
  perform private.persist_client_payload_with_server_economy(v_user,v_payload,'0.1.51');
  r:=private.ensure_run_consumables(v_user,r);
  bag:=jsonb_build_object('healing_lesser',r.potion_lesser,'healing_standard',r.potion_standard,
    'healing_greater',r.potion_greater,'healing_supreme',r.potion_supreme,'revival',r.revival_count);
  select payload into v_payload from public.game_saves where user_id=v_user;
  v_payload:=jsonb_set(v_payload,'{expedition,bag}',bag,true);
  update public.game_saves set payload=v_payload,
    payload_hash=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex'),
    updated_at=now() where user_id=v_user;
  return private.cloud_record_json(v_user);
end $$;
revoke all on function public.start_online_expedition(uuid,bigint,text,text,text,integer,jsonb) from public,anon;
grant execute on function public.start_online_expedition(uuid,bigint,text,text,text,integer,jsonb) to authenticated;

create or replace function private.server_start_encounter(
 p_user uuid,p_run private.online_expeditions,p_profile jsonb,p_prior private.online_combat_states
) returns private.online_combat_states
language plpgsql security definer set search_path=''
as $$
declare
 s public.game_saves%rowtype;combat_payload jsonb;st jsonb;passive jsonb;j text;c private.online_combat_states%rowtype;
 hp bigint;mh bigint;ma numeric;md numeric;weapon text;crit numeric;hits int;
 pe jsonb:='[]'::jsonb;me jsonb:='[]'::jsonb;nextcd jsonb:='{}'::jsonb;statev bigint:=1;
begin
 select * into s from public.game_saves where user_id=p_user;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 combat_payload:=private.server_authoritative_payload(p_user,s.payload);
 combat_payload:=jsonb_set(combat_payload,'{expedition,equipment}',coalesce(p_run.equipment_snapshot,'{}'::jsonb),true);
 combat_payload:=jsonb_set(combat_payload,'{currentJobId}',
   case when p_run.job_snapshot_id is null then 'null'::jsonb else to_jsonb(p_run.job_snapshot_id) end,true);
 st:=private.combat_equipment_stats(p_user,combat_payload);
 passive:=private.combat_accessory_passive(combat_payload);
 j:=case when p_run.job_snapshot_id in('contract_mercenary','hunter','field_medic','duelist','berserker') then p_run.job_snapshot_id else null end;

 if p_prior.user_id is not null then
   pe:=(select coalesce(jsonb_agg(e),'[]'::jsonb) from jsonb_array_elements(coalesce(p_prior.player_effects,'[]'::jsonb))e where e->>'scope'='EXPEDITION');
   select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}'::jsonb)
   into nextcd from jsonb_each(coalesce(p_prior.cooldowns,'{}'::jsonb));
   statev:=p_prior.state_version+1;
 end if;
 hp:=least((st->>'hp')::bigint,greatest(1,coalesce(p_prior.player_hp,(st->>'hp')::bigint)));
 mh:=round(private.server_monster_hp(p_run.floor)*(p_profile->>'hpMultiplier')::numeric);
 ma:=private.server_monster_attack(p_run.floor)*(p_profile->>'attackMultiplier')::numeric;
 md:=private.server_monster_defense(p_run.floor)+coalesce((p_profile->>'defenseBonus')::numeric,0);
 weapon:=st->>'weapon';crit:=case weapon when 'dagger' then .2 else .05 end;hits:=case when weapon='bow' then 2 else 1 end;
 me:=private.server_initial_monster_effects(p_profile->>'id',coalesce(p_prior.monster_turn,0));

 insert into private.online_combat_states(
   user_id,run_id,encounter_index,monster_id,player_hp,player_max_hp,player_attack,player_defense,
   monster_hp,monster_max_hp,monster_attack,monster_defense,turn_no,phase,action_nonce,
   potion_lesser,potion_standard,potion_greater,potion_supreme,cooldowns,rng_seed,crit_chance,crit_damage,basic_hits,
   skill_power,guard_turns,revival_count,pending_revival,accessory_passive,accessory_value,
   player_effects,monster_effects,player_shield,monster_shield,monster_cooldowns,monster_prepared_action,
   job_id,job_resource,job_flags,state_version,player_turn,monster_turn,player_shield_hits,monster_shield_hits,
   monster_reactive_action,return_authorized,updated_at
 ) values(
   p_user,p_run.run_id,p_run.encounter_index,p_profile->>'id',hp,(st->>'hp')::bigint,(st->>'attack')::numeric,(st->>'defense')::numeric,
   mh,mh,ma,md,1,'PLAYER_TURN',0,
   coalesce(p_run.potion_lesser,0),coalesce(p_run.potion_standard,0),coalesce(p_run.potion_greater,0),coalesce(p_run.potion_supreme,0),
   nextcd,p_run.reward_seed,crit,1.5,hits,private.combat_skill_power(combat_payload),0,coalesce(p_run.revival_count,0),false,
   passive->>'kind',coalesce((passive->>'value')::numeric,0),
   pe,me,0,0,'{}'::jsonb,null,j,case when j='berserker' then coalesce(p_prior.job_resource,0) else 0 end,
   coalesce(p_prior.job_flags,'{}'::jsonb),statev,coalesce(p_prior.player_turn,0)+1,coalesce(p_prior.monster_turn,0),0,0,null,false,now()
 )
 on conflict(user_id) do update set
   run_id=excluded.run_id,encounter_index=excluded.encounter_index,monster_id=excluded.monster_id,
   player_hp=excluded.player_hp,player_max_hp=excluded.player_max_hp,player_attack=excluded.player_attack,player_defense=excluded.player_defense,
   monster_hp=excluded.monster_hp,monster_max_hp=excluded.monster_max_hp,monster_attack=excluded.monster_attack,monster_defense=excluded.monster_defense,
   turn_no=1,phase='PLAYER_TURN',action_nonce=0,potion_lesser=excluded.potion_lesser,potion_standard=excluded.potion_standard,
   potion_greater=excluded.potion_greater,potion_supreme=excluded.potion_supreme,cooldowns=excluded.cooldowns,rng_seed=excluded.rng_seed,
   crit_chance=excluded.crit_chance,crit_damage=excluded.crit_damage,basic_hits=excluded.basic_hits,skill_power=excluded.skill_power,
   guard_turns=0,revival_count=excluded.revival_count,pending_revival=false,accessory_passive=excluded.accessory_passive,
   accessory_value=excluded.accessory_value,player_effects=excluded.player_effects,monster_effects=excluded.monster_effects,
   player_shield=0,monster_shield=0,monster_cooldowns='{}'::jsonb,monster_prepared_action=null,job_id=excluded.job_id,
   job_resource=excluded.job_resource,job_flags=excluded.job_flags,state_version=excluded.state_version,
   player_turn=excluded.player_turn,monster_turn=excluded.monster_turn,player_shield_hits=0,monster_shield_hits=0,
   monster_reactive_action=null,return_authorized=false,updated_at=now()
 returning * into c;

 if c.monster_id='sanctuary_talon_bishop' then c:=private.sync_server_shield(c,'monster','blood_rite_ward');end if;
 update private.online_combat_states set
   monster_shield=c.monster_shield,monster_shield_hits=c.monster_shield_hits,monster_effects=c.monster_effects
 where user_id=p_user returning * into c;
 return c;
end $$;
revoke all on function private.server_start_encounter(uuid,private.online_expeditions,jsonb,private.online_combat_states)
 from public,anon,authenticated;
