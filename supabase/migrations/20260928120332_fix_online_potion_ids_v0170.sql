-- v0.1.70: accept canonical potion IDs in online combat and return authoritative bag counts.

create or replace function public.apply_online_potion(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_action_nonce bigint,
  p_potion text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  u uuid;
  r private.online_expeditions%rowtype;
  c private.online_combat_states%rowtype;
  potion_key text;
  ratio numeric;
  heal bigint;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);

  select * into r from private.online_expeditions where user_id=u for update;
  select * into c from private.online_combat_states where user_id=u for update;

  if not found or r.status<>'ACTIVE' or c.run_id<>r.run_id or c.phase<>'PLAYER_TURN' then
    raise exception 'COMBAT_PHASE_INVALID';
  end if;
  if p_action_nonce<>c.action_nonce+1 then
    raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';
  end if;

  r:=private.ensure_run_consumables(u,r);

  potion_key:=case p_potion
    when 'healing_lesser' then 'lesser'
    when 'healing_standard' then 'standard'
    when 'healing_greater' then 'greater'
    when 'healing_supreme' then 'supreme'
    when 'lesser' then 'lesser'
    when 'standard' then 'standard'
    when 'greater' then 'greater'
    when 'supreme' then 'supreme'
    else null
  end;

  ratio:=case potion_key
    when 'lesser' then .20
    when 'standard' then .35
    when 'greater' then .50
    when 'supreme' then .75
    else null
  end;

  if ratio is null or c.player_hp>=c.player_max_hp then
    raise exception 'COMBAT_POTION_INVALID';
  end if;

  if potion_key='lesser' and coalesce(r.potion_lesser,0)>0 then
    r.potion_lesser:=r.potion_lesser-1;
  elsif potion_key='standard' and coalesce(r.potion_standard,0)>0 then
    r.potion_standard:=r.potion_standard-1;
  elsif potion_key='greater' and coalesce(r.potion_greater,0)>0 then
    r.potion_greater:=r.potion_greater-1;
  elsif potion_key='supreme' and coalesce(r.potion_supreme,0)>0 then
    r.potion_supreme:=r.potion_supreme-1;
  else
    raise exception 'COMBAT_POTION_EMPTY';
  end if;

  if c.job_id='field_medic' then ratio:=ratio*1.2; end if;

  heal:=least(c.player_max_hp-c.player_hp,round(c.player_max_hp*ratio));
  c.player_hp:=least(c.player_max_hp,c.player_hp+heal);

  update private.online_expeditions set
    potion_lesser=r.potion_lesser,
    potion_standard=r.potion_standard,
    potion_greater=r.potion_greater,
    potion_supreme=r.potion_supreme,
    run_version=run_version+1
  where user_id=u returning * into r;

  perform private.persist_run_bag_to_save(u,r);

  update private.online_combat_states set
    player_hp=c.player_hp,
    potion_lesser=r.potion_lesser,
    potion_standard=r.potion_standard,
    potion_greater=r.potion_greater,
    potion_supreme=r.potion_supreme
  where user_id=u returning * into c;

  return private.finish_server_player_action(u,r,c,p_action_nonce,0)
    || jsonb_build_object(
      'healing',heal,
      'potions',jsonb_build_object(
        'healing_lesser',r.potion_lesser,
        'healing_standard',r.potion_standard,
        'healing_greater',r.potion_greater,
        'healing_supreme',r.potion_supreme
      ),
      'jobResource',c.job_resource,
      'jobFlags',c.job_flags
    );
end;
$$;

revoke all on function public.apply_online_potion(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.apply_online_potion(uuid,bigint,text,text,bigint,text) to authenticated;
