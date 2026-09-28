-- v0.1.64: deterministic Iron enhancement-stone combat drops.
-- Drops stay expedition-temporary and are only credited when the run safely returns.

create or replace function private.server_enhancement_stone_drop(
  p_run private.online_expeditions,
  p_kill bigint,
  p_monster_id text
) returns bigint
language plpgsql stable set search_path=''
as $$
declare
  v_boss boolean:=false;
  v_chance numeric:=0;
  v_roll numeric:=0;
  v_quantity_roll numeric:=0;
begin
  if p_run.tower<>'ore' or p_run.floor<1 or p_run.floor>10 then return 0;end if;

  v_boss:=private.server_boss_id(p_run.tower,p_run.floor)=p_monster_id;
  if v_boss then
    return case p_run.floor
      when 6 then 3
      when 7 then 4
      when 8 then 5
      when 9 then 7
      when 10 then 10
      else 0
    end;
  end if;

  v_chance:=case p_run.floor
    when 1 then 0.12
    when 2 then 0.14
    when 3 then 0.16
    when 4 then 0.18
    when 5 then 0.20
    when 6 then 0.22
    when 7 then 0.25
    when 8 then 0.28
    when 9 then 0.32
    when 10 then 0.38
    else 0
  end;

  v_roll:=private.server_roll(p_run.reward_seed,p_kill,6411,1);
  if v_roll>=v_chance then return 0;end if;

  v_quantity_roll:=private.server_roll(p_run.reward_seed,p_kill,6412,2);
  if p_run.floor<=4 then return 1;end if;
  if p_run.floor<=7 then return case when v_quantity_roll<0.30 then 1 else 2 end;end if;
  if p_run.floor=8 then return case when v_quantity_roll<0.50 then 1 else 2 end;end if;
  if p_run.floor=9 then
    return case when v_quantity_roll<0.50 then 1 when v_quantity_roll<0.85 then 2 else 3 end;
  end if;
  return case when v_quantity_roll<0.40 then 1 when v_quantity_roll<0.80 then 2 else 3 end;
end;$$;
revoke all on function private.server_enhancement_stone_drop(private.online_expeditions,bigint,text)
from public,anon,authenticated;

create or replace function private.server_run_enhancement_stones(
  p_run private.online_expeditions
) returns bigint
language sql stable set search_path=''
as $$
  select coalesce(sum(private.server_enhancement_stone_drop(p_run,k.kill_index,k.monster_id)),0)::bigint
  from private.online_expedition_kills k
  where k.user_id=p_run.user_id and k.run_id=p_run.run_id
$$;
revoke all on function private.server_run_enhancement_stones(private.online_expeditions)
from public,anon,authenticated;

create or replace function private.server_kill_loot(
  p_run private.online_expeditions,
  p_kill bigint
) returns jsonb
language plpgsql stable set search_path=''
as $$
declare
  s bigint:=10+p_run.floor*3;
  m bigint:=2;
  t bigint:=0;
  monster_id text;
  equipment jsonb;
  stones bigint:=0;
begin
  if p_run.floor<10 and private.expedition_ticket_drop(p_run.reward_seed,p_kill) then t:=1;end if;

  select k.monster_id into monster_id
  from private.online_expedition_kills k
  where k.user_id=p_run.user_id and k.run_id=p_run.run_id and k.kill_index=p_kill;

  equipment:=private.server_iron_equipment_drop(p_run,p_kill,monster_id);
  stones:=private.server_enhancement_stone_drop(p_run,p_kill,monster_id);

  return jsonb_build_object(
    'silver',s,
    'material',m,
    'tickets',t,
    'equipment',equipment,
    'enhancementStones',stones
  );
end;$$;
revoke all on function private.server_kill_loot(private.online_expeditions,bigint)
from public,anon,authenticated;

create or replace function private.credit_returned_enhancement_stones()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  v_stones bigint:=0;
begin
  if old.status='ACTIVE' and new.status='RETURNED' then
    v_stones:=private.server_run_enhancement_stones(new);
    if v_stones>0 then
      insert into private.market_assets(user_id,item_id,quantity,updated_at)
      values(new.user_id,'other:enhancement_stone',v_stones,now())
      on conflict(user_id,item_id) do update
      set quantity=private.market_assets.quantity+excluded.quantity,
          updated_at=now();
    end if;
  end if;
  return new;
end;$$;
revoke all on function private.credit_returned_enhancement_stones()
from public,anon,authenticated;

drop trigger if exists credit_returned_enhancement_stones_trigger on private.online_expeditions;
create trigger credit_returned_enhancement_stones_trigger
after update of status on private.online_expeditions
for each row
when (old.status='ACTIVE' and new.status='RETURNED')
execute function private.credit_returned_enhancement_stones();

create or replace function public.restore_online_expedition(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  r private.online_expeditions%rowtype;
  c private.online_combat_states%rowtype;
  temporary_loot jsonb;
  stones bigint:=0;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into r from private.online_expeditions where user_id=u;
  if not found or r.status<>'ACTIVE' then return jsonb_build_object('active',false);end if;

  r:=private.ensure_run_consumables(u,r);
  select * into c from private.online_combat_states where user_id=u and run_id=r.run_id;

  stones:=private.server_run_enhancement_stones(r);
  temporary_loot:=jsonb_set(
    coalesce(r.temporary_loot,'{}'::jsonb),
    '{enhancementStones}',
    to_jsonb(stones),
    true
  );

  return jsonb_build_object(
    'active',true,
    'run',jsonb_build_object(
      'runId',r.run_id,
      'tower',r.tower,
      'floor',r.floor,
      'confirmedKills',r.confirmed_kills,
      'encounterIndex',r.encounter_index,
      'bossProgress',r.boss_progress,
      'bossDefeated',r.boss_defeated,
      'pendingEvent',r.pending_event,
      'temporaryLoot',temporary_loot,
      'stronghold',r.stronghold,
      'runVersion',r.run_version,
      'potions',jsonb_build_object(
        'lesser',r.potion_lesser,
        'standard',r.potion_standard,
        'greater',r.potion_greater,
        'supreme',r.potion_supreme,
        'revival',r.revival_count
      )
    ),
    'combat',case when c.user_id is null then null else jsonb_build_object(
      'encounterIndex',c.encounter_index,
      'monsterId',c.monster_id,
      'monsterHp',c.monster_hp,
      'monsterMaxHp',c.monster_max_hp,
      'monsterAttack',c.monster_attack,
      'monsterDefense',c.monster_defense,
      'playerHp',c.player_hp,
      'playerMaxHp',c.player_max_hp,
      'playerShield',c.player_shield,
      'monsterShield',c.monster_shield,
      'playerShieldHits',c.player_shield_hits,
      'monsterShieldHits',c.monster_shield_hits,
      'playerEffects',c.player_effects,
      'monsterEffects',c.monster_effects,
      'monsterCooldowns',c.monster_cooldowns,
      'monsterPreparedAction',c.monster_prepared_action,
      'monsterReactiveAction',c.monster_reactive_action,
      'jobId',c.job_id,
      'jobResource',c.job_resource,
      'jobFlags',c.job_flags,
      'playerCooldowns',c.cooldowns,
      'stateVersion',c.state_version,
      'playerTurn',c.player_turn,
      'monsterTurn',c.monster_turn,
      'turnNo',c.turn_no,
      'phase',c.phase,
      'pendingRevival',c.pending_revival,
      'actionNonce',c.action_nonce,
      'returnAuthorized',c.return_authorized
    ) end
  );
end;$$;
revoke all on function public.restore_online_expedition(uuid,bigint,text,text) from public,anon;
grant execute on function public.restore_online_expedition(uuid,bigint,text,text) to authenticated;
