-- v0.1.50 authored exploration event selection and boss-choice parity.
alter table private.online_expeditions add column if not exists recent_event_ids text[] not null default '{}'::text[];

create or replace function private.server_normal_event_id(p_tower text,p_floor integer,p_hp bigint,p_max_hp bigint,p_recent text[],p_roll numeric)
returns text language plpgsql immutable set search_path=''
as $$
declare ids text[]:=array[]::text[];weights numeric[]:=array[]::numeric[];total numeric:=0;cursor numeric:=0;i int;
begin
 if p_max_hp>0 and p_hp::numeric/p_max_hp<.8 and not ('common_rest'=any(p_recent)) then ids:=array_append(ids,'common_rest');weights:=array_append(weights,1);end if;
 if not ('common_cache'=any(p_recent)) then ids:=array_append(ids,'common_cache');weights:=array_append(weights,1);end if;
 if not (('resource_gather_'||p_tower)=any(p_recent)) then ids:=array_append(ids,'resource_gather_'||p_tower);weights:=array_append(weights,1);end if;
 if not ('common_risk'=any(p_recent)) then ids:=array_append(ids,'common_risk');weights:=array_append(weights,1);end if;
 if not ('common_remedy'=any(p_recent)) then ids:=array_append(ids,'common_remedy');weights:=array_append(weights,1);end if;
 -- Stronghold is intentionally excluded until its 15-minute ownership runtime is server-authoritative.
 if coalesce(array_length(ids,1),0)=0 then return null;end if;
 select sum(x) into total from unnest(weights)x;
 for i in 1..array_length(ids,1) loop cursor:=cursor+weights[i]/total;if p_roll<cursor then return ids[i];end if;end loop;
 return ids[array_length(ids,1)];
end $$;
revoke all on function private.server_normal_event_id(text,integer,bigint,bigint,text[],numeric) from public,anon,authenticated;

create or replace function public.advance_online_exploration(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;boss text;chance numeric;roll numeric;event_roll numeric;event_id text;profile jsonb;pending jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 if r.pending_event is not null then return jsonb_build_object('kind','EVENT','event',r.pending_event,'runVersion',r.run_version);end if;
 select * into c from private.online_combat_states where user_id=u;
 boss:=private.server_boss_id(r.tower,r.floor);
 if boss is not null and not r.boss_defeated then
  chance:=case when r.boss_progress>=20 then 1 else least(1,.03+r.boss_progress*.02) end;
  roll:=private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,501);
  if roll<chance then
   pending:=jsonb_build_object('id','boss_encounter','bossId',boss,'ticket',private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,503));
   update private.online_expeditions set pending_event=pending,boss_progress=0,recent_event_ids=array['boss_encounter'],run_version=run_version+1 where user_id=u returning * into r;
   return jsonb_build_object('kind','EVENT','event',pending,'runVersion',r.run_version);
  end if;
 end if;
 event_roll:=private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,502);
 if event_roll<.25 then
  event_id:=private.server_normal_event_id(r.tower,r.floor,coalesce(c.player_hp,1),coalesce(c.player_max_hp,1),r.recent_event_ids,private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,504));
  if event_id is not null then
   pending:=jsonb_build_object('id',event_id,'ticket',private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,503));
   update private.online_expeditions set pending_event=pending,recent_event_ids=array[event_id],run_version=run_version+1 where user_id=u returning * into r;
   return jsonb_build_object('kind','EVENT','event',pending,'runVersion',r.run_version);
  end if;
 end if;
 update private.online_expeditions set encounter_index=encounter_index+1,run_version=run_version+1 where user_id=u returning * into r;
 profile:=private.server_monster_profile(r.tower,r.floor,r.reward_seed,r.encounter_index);
 return jsonb_build_object('kind','MONSTER','profile',profile,'encounterIndex',r.encounter_index,'bossProgress',r.boss_progress,'runVersion',r.run_version);
end $$;
revoke all on function public.advance_online_exploration(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.advance_online_exploration(uuid,bigint,text,text,bigint) to authenticated;
