-- v0.1.50 server-authored exploration event catalog and deterministic outcome resolution.
create or replace function private.server_event_id(p_tower text,p_floor int,p_hp bigint,p_max_hp bigint,p_ticket numeric)
returns text language plpgsql immutable set search_path='' as $$
declare ids text[]:=array[]::text[];weights numeric[]:=array[]::numeric[];total numeric:=0;v numeric;i int;
begin
 if p_max_hp>0 and p_hp::numeric/p_max_hp<.8 then ids:=ids||'common_rest';weights:=weights||1;end if;
 ids:=ids||'common_cache';weights:=weights||1;
 ids:=ids||('resource_gather_'||p_tower);weights:=weights||1;
 ids:=ids||'common_risk';weights:=weights||1;
 ids:=ids||'common_remedy';weights:=weights||1;
 if p_floor between 3 and 10 then ids:=ids||'resource_stronghold';weights:=weights||.65;end if;
 select sum(x) into total from unnest(weights)x;v:=p_ticket*total;
 for i in 1..array_length(ids,1) loop if v<weights[i] then return ids[i];end if;v:=v-weights[i];end loop;
 return ids[array_length(ids,1)];
end $$;
revoke all on function private.server_event_id(text,int,bigint,bigint,numeric) from public,anon,authenticated;

create or replace function private.server_event_outcome(p_event text,p_choice text,p_ticket numeric)
returns text language plpgsql immutable set search_path='' as $$
begin
 if p_choice='skip' then return null;end if;
 if p_event='common_rest' then return case when p_ticket<.2 then 'great' when p_ticket<.8 then 'success' else 'failure' end;end if;
 if p_event='common_cache' or p_event like 'resource_gather_%' then return case when p_ticket<.15 then 'great' when p_ticket<.75 then 'success' else 'failure' end;end if;
 if p_event='common_risk' then return case when p_ticket<.15 then 'great' when p_ticket<.6 then 'success' else 'failure' end;end if;
 if p_event='common_remedy' then return case when p_ticket<.2 then 'great' when p_ticket<.75 then 'success' else 'failure' end;end if;
 return null;
end $$;
revoke all on function private.server_event_outcome(text,text,numeric) from public,anon,authenticated;

create or replace function public.resolve_online_exploration_event(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint,p_choice text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;e jsonb;id text;ticket numeric;outcome text;hp bigint;maxhp bigint;mat int:=0;silver int:=0;damage int:=0;heal numeric:=0;effect text;choice text:=p_choice;boss text;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 e:=r.pending_event;if e is null then raise exception 'EXPEDITION_EVENT_MISSING';end if;id:=e->>'id';ticket:=coalesce((e->>'outcomeTicket')::numeric,(e->>'ticket')::numeric,0);
 select * into c from private.online_combat_states where user_id=u;hp:=coalesce(c.player_hp,1);maxhp:=coalesce(c.player_max_hp,hp);
 if id='boss_encounter' then
  if choice not in('challenge','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
  boss:=e->>'bossId';update private.online_expeditions set pending_event=null,run_version=run_version+1 where user_id=u returning * into r;
  return jsonb_build_object('eventId',id,'choiceId',choice,'next',case when choice='challenge' then 'BOSS' else 'NORMAL' end,'bossId',case when choice='challenge' then boss else null end,'runVersion',r.run_version);
 end if;
 if id='resource_stronghold' then
  if choice not in('claim','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
  -- Stronghold claim remains fail-closed until its dedicated server runtime is migrated.
  if choice='claim' then raise exception 'RESOURCE_STRONGHOLD_SERVER_REQUIRED';end if;
  update private.online_expeditions set pending_event=null,run_version=run_version+1 where user_id=u returning * into r;
  return jsonb_build_object('eventId',id,'choiceId','skip','outcomeId',null,'runVersion',r.run_version);
 end if;
 if id='common_rest' then if choice not in('rest','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 elsif id='common_cache' then if choice not in('take','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 elsif id like 'resource_gather_%' then if choice not in('gather','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 elsif id='common_risk' then if choice not in('search','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 elsif id='common_remedy' then if choice not in('breathe','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 else raise exception 'EXPEDITION_EVENT_UNKNOWN';end if;
 outcome:=private.server_event_outcome(id,choice,ticket);
 if choice<>'skip' then
  if id='common_rest' then if outcome='great' then heal:=.25;elsif outcome='success' then heal:=.15;else damage:=8;end if;
  elsif id='common_cache' then if outcome='great' then r.potion_standard:=coalesce(r.potion_standard,0)+1;r.potion_lesser:=coalesce(r.potion_lesser,0)+1;elsif outcome='success' then r.potion_lesser:=coalesce(r.potion_lesser,0)+1;else damage:=12;end if;
  elsif id like 'resource_gather_%' then if outcome='great' then mat:=5;silver:=15;elsif outcome='success' then mat:=3;else damage:=case r.tower when 'ore' then 14 else 0 end;effect:=case r.tower when 'leather' then 'fang_wound' when 'gem' then 'crystal_fracture' when 'kaleon' then 'kaleon_blight' end;end if;
  elsif id='common_risk' then if outcome='great' then silver:=50;elsif outcome='success' then silver:=25;else damage:=18;end if;
  elsif id='common_remedy' then if outcome='great' then heal:=.15;elsif outcome='success' then heal:=.05;else effect:='weaken';end if;end if;
 end if;
 hp:=greatest(0,least(maxhp,hp+floor(maxhp*heal)::bigint-damage));
 if effect is not null then c.player_effects:=private.apply_server_effect(coalesce(c.player_effects,'[]'),effect,c.player_turn);end if;
 if id='common_remedy' and outcome in('great','success') then c.player_effects:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(coalesce(c.player_effects,'[]'))x where x->>'effectId' not in('poison','kaleon_blight'));end if;
 r.temporary_loot:=jsonb_set(jsonb_set(coalesce(r.temporary_loot,'{}'),'{silver}',to_jsonb(coalesce((r.temporary_loot->>'silver')::int,0)+silver),true),'{material}',to_jsonb(coalesce((r.temporary_loot->>'material')::int,0)+mat),true);
 update private.online_expeditions set pending_event=null,temporary_loot=r.temporary_loot,potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,run_version=run_version+1 where user_id=u returning * into r;
 update private.online_combat_states set player_hp=hp,player_effects=coalesce(c.player_effects,'[]'),potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,pending_revival=(hp=0 and coalesce(r.revival_count,0)>0),phase=case when hp=0 then 'PLAYER_DEAD' else phase end,updated_at=now() where user_id=u;
 perform private.persist_run_bag_to_save(u,r);
 return jsonb_build_object('eventId',id,'choiceId',choice,'outcomeId',outcome,'playerHp',hp,'temporaryLoot',r.temporary_loot,'runVersion',r.run_version,'pendingRevival',(hp=0 and coalesce(r.revival_count,0)>0));
end $$;
revoke all on function public.resolve_online_exploration_event(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.resolve_online_exploration_event(uuid,bigint,text,text,bigint,text) to authenticated;
