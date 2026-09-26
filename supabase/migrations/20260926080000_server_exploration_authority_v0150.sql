-- v0.1.50 canonical exploration/progression state owned by the active server run.
alter table private.online_expeditions
 add column if not exists encounter_index bigint not null default 0,
 add column if not exists boss_progress integer not null default 0,
 add column if not exists boss_defeated boolean not null default false,
 add column if not exists pending_event jsonb,
 add column if not exists temporary_loot jsonb not null default '{"silver":0,"material":0,"tickets":0}'::jsonb,
 add column if not exists run_version bigint not null default 1;

create or replace function private.server_boss_id(p_tower text,p_floor integer)
returns text language sql immutable set search_path='' as $$
 select case p_tower
 when 'ore' then case p_floor when 6 then 'iron_maw_burrower' when 7 then 'black_vein_armor_breaker' when 8 then 'echo_devourer' when 9 then 'deep_hoist_overseer' when 10 then 'iron_core_pulsator' end
 when 'leather' then case p_floor when 6 then 'bloodmane_tracker' when 7 then 'redjaw_hide_eater' when 8 then 'fang_pack_matriarch' when 9 then 'sanctuary_talon_bishop' when 10 then 'lord_of_red_fang' end
 when 'gem' then case p_floor when 6 then 'white_crystal_armor_behemoth' when 7 then 'myriad_refraction_predator' when 8 then 'pulsing_crystal_core_growth' when 9 then 'thousand_face_crystal_beast' when 10 then 'celestial_core_matrix' end
 when 'kaleon' then case p_floor when 6 then 'greenwrought_gatekeeper' when 7 then 'overgrowth_regenerator' when 8 then 'transfer_subject_c17' when 9 then 'atonement_prototype' when 10 then 'false_saint_caleon' end end
$$;
revoke all on function private.server_boss_id(text,integer) from public,anon,authenticated;

create or replace function private.server_boss_profile(p_tower text,p_floor integer)
returns jsonb language plpgsql immutable set search_path=''
as $$
declare id text:=private.server_boss_id(p_tower,p_floor);hm numeric;am numeric;db numeric;
begin
 if id is null then return null;end if;
 select x.hm,x.am,x.db into hm,am,db from (values
 ('iron_maw_burrower',3.4,1.45,2),('black_vein_armor_breaker',4.1,1.55,4),('echo_devourer',4.8,1.7,5),('deep_hoist_overseer',5.6,1.82,6),('iron_core_pulsator',6.6,2,8),
 ('bloodmane_tracker',3.2,1.5,2),('redjaw_hide_eater',3.9,1.6,4),('fang_pack_matriarch',4.6,1.72,5),('sanctuary_talon_bishop',5.4,1.85,6),('lord_of_red_fang',6.4,2.05,8),
 ('white_crystal_armor_behemoth',3.5,1.42,3),('myriad_refraction_predator',4,1.58,3),('pulsing_crystal_core_growth',4.8,1.62,5),('thousand_face_crystal_beast',5.7,1.78,6),('celestial_core_matrix',6.8,2,8),
 ('greenwrought_gatekeeper',3.5,1.42,4),('overgrowth_regenerator',4.2,1.5,4),('transfer_subject_c17',4.8,1.65,5),('atonement_prototype',5.6,1.78,6),('false_saint_caleon',6.8,2,8)
 )x(id,hm,am,db) where x.id=id;
 return jsonb_build_object('id',id,'hpMultiplier',hm,'attackMultiplier',am,'defenseBonus',db);
end $$;
revoke all on function private.server_boss_profile(text,integer) from public,anon,authenticated;

create or replace function public.advance_online_exploration(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;boss text;chance numeric;roll numeric;event_roll numeric;kind text:='MONSTER';profile jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 if r.pending_event is not null then return jsonb_build_object('kind','EVENT','event',r.pending_event,'runVersion',r.run_version);end if;
 boss:=private.server_boss_id(r.tower,r.floor);
 if boss is not null and not r.boss_defeated then
  chance:=case when r.boss_progress>=20 then 1 else least(1,.03+r.boss_progress*.02) end;
  roll:=private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version::bigint,501);
  if roll<chance then kind:='BOSS';profile:=private.server_boss_profile(r.tower,r.floor);end if;
 end if;
 if kind='MONSTER' then
  event_roll:=private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version::bigint,502);
  if event_roll<.25 then kind:='EVENT';end if;
 end if;
 if kind='EVENT' then
  update private.online_expeditions set pending_event=jsonb_build_object('id','server_exploration_event','ticket',private.server_roll(reward_seed,encounter_index+1,run_version,503)),run_version=run_version+1 where user_id=u returning * into r;
  return jsonb_build_object('kind','EVENT','event',r.pending_event,'runVersion',r.run_version);
 end if;
 update private.online_expeditions set encounter_index=encounter_index+1,boss_progress=case when kind='BOSS' then 0 else boss_progress end,run_version=run_version+1 where user_id=u returning * into r;
 if profile is null then profile:=private.server_monster_profile(r.tower,r.floor,r.reward_seed,r.encounter_index);end if;
 return jsonb_build_object('kind',kind,'profile',profile,'encounterIndex',r.encounter_index,'bossProgress',r.boss_progress,'runVersion',r.run_version);
end $$;
revoke all on function public.advance_online_exploration(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.advance_online_exploration(uuid,bigint,text,text,bigint) to authenticated;
