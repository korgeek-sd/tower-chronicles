-- v0.1.50 canonical exploration continuation.
-- A server-confirmed battle result is the only source for the next encounter/event.

create or replace function private.server_start_encounter(
 p_user uuid,
 p_run private.online_expeditions,
 p_profile jsonb,
 p_prior private.online_combat_states
) returns private.online_combat_states
language plpgsql security definer set search_path=''
as $$
declare
 s public.game_saves%rowtype;st jsonb;passive jsonb;j text;c private.online_combat_states%rowtype;
 hp bigint;mh bigint;ma numeric;md numeric;weapon text;crit numeric;hits int;
 pe jsonb:='[]'::jsonb;me jsonb:='[]'::jsonb;nextcd jsonb:='{}'::jsonb;statev bigint:=1;
begin
 select * into s from public.game_saves where user_id=p_user;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 st:=private.combat_equipment_stats(p_user,s.payload);passive:=private.combat_accessory_passive(s.payload);j:=private.require_server_combat_job(s.payload);
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
   nextcd,p_run.reward_seed,crit,1.5,hits,private.combat_skill_power(s.payload),0,coalesce(p_run.revival_count,0),false,
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

create or replace function private.server_pending_event(
 p_run private.online_expeditions,p_event_id text,p_boss_id text,p_selection numeric,p_outcome numeric
) returns jsonb
language plpgsql stable set search_path=''
as $$
declare expires bigint:=null;
begin
 if p_event_id='resource_stronghold' then
   expires:=round(extract(epoch from (clock_timestamp()+interval '30 seconds'))*1000)::bigint;
 end if;
 return jsonb_build_object(
   'instanceId','server-event-'||p_run.run_id::text||'-'||(p_run.run_version+1)::text,
   'eventId',p_event_id,'id',p_event_id,'bossId',p_boss_id,'state','CHOICE',
   'choiceId',null,'outcomeId',null,'resultText','','resultLines','[]'::jsonb,'next','NORMAL',
   'randomValue',coalesce(p_outcome,0),'selectionTicket',p_selection,'outcomeTicket',p_outcome,'expiresAt',expires
 );
end $$;
revoke all on function private.server_pending_event(private.online_expeditions,text,text,numeric,numeric)
 from public,anon,authenticated;

create or replace function public.continue_online_expedition(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;e jsonb;
 boss text;profile jsonb;chance numeric;roll numeric;er numeric;sel numeric;outcome numeric;eid text;
 next_kind text:='MONSTER';next_boss text;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 r:=private.ensure_run_consumables(u,r);
 select * into c from private.online_combat_states where user_id=u for update;

 if r.pending_event is not null then
   e:=r.pending_event;
   if coalesce(e->>'state','CHOICE')<>'RESULT' then
     return jsonb_build_object('kind','EVENT','event',e,'runVersion',r.run_version);
   end if;
   next_kind:=coalesce(e->>'next','NORMAL');next_boss:=e->>'bossId';
   update private.online_expeditions
   set pending_event=null,encounter_index=encounter_index+1,run_version=run_version+1
   where user_id=u returning * into r;
   if next_kind='BOSS' then
     profile:=private.server_boss_profile(r.tower,r.floor);
     if profile is null or profile->>'id'<>next_boss then raise exception 'EXPEDITION_BOSS_INVALID';end if;
   else
     profile:=private.server_monster_profile(r.tower,r.floor,r.reward_seed,r.encounter_index);
   end if;
   c:=private.server_start_encounter(u,r,profile,c);
   return jsonb_build_object('kind',case when next_kind='BOSS' then 'BOSS' else 'MONSTER' end,
     'profile',profile,'encounterIndex',r.encounter_index,'bossProgress',r.boss_progress,
     'runVersion',r.run_version,'combat',to_jsonb(c));
 end if;

 if c.user_id is null or c.run_id<>r.run_id or c.phase<>'DEFEATED' then raise exception 'EXPEDITION_CONTINUE_INVALID';end if;

 -- Defeating the floor boss immediately resumes normal exploration.
 if private.server_boss_id(r.tower,r.floor)=c.monster_id then
   update private.online_expeditions set encounter_index=encounter_index+1,run_version=run_version+1
   where user_id=u returning * into r;
   profile:=private.server_monster_profile(r.tower,r.floor,r.reward_seed,r.encounter_index);
   c:=private.server_start_encounter(u,r,profile,c);
   return jsonb_build_object('kind','MONSTER','profile',profile,'encounterIndex',r.encounter_index,
     'bossProgress',r.boss_progress,'runVersion',r.run_version,'combat',to_jsonb(c));
 end if;

 boss:=private.server_boss_id(r.tower,r.floor);
 if boss is not null and not r.boss_defeated then
   chance:=case when r.boss_progress>=20 then 1 else least(1,.03+r.boss_progress*.02) end;
   roll:=private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,501);
   if roll<chance then
     e:=private.server_pending_event(r,'boss_encounter',boss,null,private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,504));
     update private.online_expeditions
     set pending_event=e,boss_progress=0,recent_event_ids=array['boss_encounter'],run_version=run_version+1
     where user_id=u returning * into r;
     return jsonb_build_object('kind','EVENT','event',r.pending_event,'runVersion',r.run_version);
   end if;
 end if;

 er:=private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,502);
 if er<.25 then
   sel:=private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,503);
   outcome:=private.server_roll(r.reward_seed,r.encounter_index+1,r.run_version,504);
   eid:=private.server_event_id(r.tower,r.floor,c.player_hp,c.player_max_hp,sel,r.recent_event_ids,r.stronghold);
   if eid is not null then
     e:=private.server_pending_event(r,eid,null,sel,outcome);
     update private.online_expeditions
     set pending_event=e,recent_event_ids=array[eid],run_version=run_version+1
     where user_id=u returning * into r;
     return jsonb_build_object('kind','EVENT','event',r.pending_event,'runVersion',r.run_version);
   end if;
 end if;

 update private.online_expeditions set encounter_index=encounter_index+1,run_version=run_version+1
 where user_id=u returning * into r;
 profile:=private.server_monster_profile(r.tower,r.floor,r.reward_seed,r.encounter_index);
 c:=private.server_start_encounter(u,r,profile,c);
 return jsonb_build_object('kind','MONSTER','profile',profile,'encounterIndex',r.encounter_index,
   'bossProgress',r.boss_progress,'runVersion',r.run_version,'combat',to_jsonb(c));
end $$;
revoke all on function public.continue_online_expedition(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.continue_online_expedition(uuid,bigint,text,text,bigint) to authenticated;

create or replace function public.advance_online_exploration(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
 return public.continue_online_expedition(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_expected_version);
end $$;
revoke all on function public.advance_online_exploration(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.advance_online_exploration(uuid,bigint,text,text,bigint) to authenticated;

create or replace function public.resolve_online_exploration_event(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint,p_choice text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;e jsonb;id text;
 ticket numeric;outcome text;hp bigint;maxhp bigint;mat int:=0;silver int:=0;damage int:=0;heal numeric:=0;
 effect text;choice text:=p_choice;boss text;result_text text:='선택한 행동을 마쳤습니다.';lines jsonb:='[]'::jsonb;
 expired boolean:=false;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 e:=r.pending_event;if e is null or coalesce(e->>'state','CHOICE')<>'CHOICE' then raise exception 'EXPEDITION_EVENT_MISSING';end if;
 id:=coalesce(e->>'eventId',e->>'id');ticket:=coalesce((e->>'outcomeTicket')::numeric,(e->>'randomValue')::numeric,0);
 if id='resource_stronghold' and e->>'expiresAt' is not null then
   expired:=round(extract(epoch from clock_timestamp())*1000)::bigint >= (e->>'expiresAt')::bigint;
   if expired then choice:='skip';end if;
 end if;
 select * into c from private.online_combat_states where user_id=u for update;
 hp:=coalesce(c.player_hp,1);maxhp:=coalesce(c.player_max_hp,hp);

 if id='boss_encounter' then
   if choice not in('challenge','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
   boss:=e->>'bossId';
   result_text:=case when choice='challenge' then '보스에게 향할 준비를 마쳤습니다.' else '흔적을 뒤로하고 다른 길로 나아갑니다.' end;
   e:=e||jsonb_build_object('state','RESULT','choiceId',choice,'outcomeId',null,'resultText',result_text,
      'resultLines','[]'::jsonb,'next',case when choice='challenge' then 'BOSS' else 'NORMAL' end);
   update private.online_expeditions set pending_event=e,run_version=run_version+1 where user_id=u returning * into r;
   return jsonb_build_object('eventId',id,'choiceId',choice,'next',e->>'next','bossId',boss,
     'pendingEvent',e,'runVersion',r.run_version);
 end if;

 if id='resource_stronghold' then
   if choice not in('claim','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
   if choice='claim' then raise exception 'RESOURCE_STRONGHOLD_SERVER_REQUIRED';end if;
   result_text:=case when expired then '30초가 지나 자원거점을 지나쳤습니다.' else '자원거점을 뒤로하고 탐사를 계속합니다.' end;
   e:=e||jsonb_build_object('state','RESULT','choiceId','skip','outcomeId',null,'resultText',result_text,
      'resultLines','[]'::jsonb,'next','NORMAL');
   update private.online_expeditions set pending_event=e,run_version=run_version+1 where user_id=u returning * into r;
   return jsonb_build_object('eventId',id,'choiceId','skip','outcomeId',null,'pendingEvent',e,'runVersion',r.run_version);
 end if;

 if id='common_rest' then if choice not in('rest','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 elsif id='common_cache' then if choice not in('take','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 elsif id like 'resource_gather_%' then if choice not in('gather','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 elsif id='common_risk' then if choice not in('search','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 elsif id='common_remedy' then if choice not in('breathe','skip') then raise exception 'EXPEDITION_EVENT_CHOICE_INVALID';end if;
 else raise exception 'EXPEDITION_EVENT_UNKNOWN';end if;

 outcome:=private.server_event_outcome(id,choice,ticket);
 if choice<>'skip' then
   if id='common_rest' then
     if outcome='great' then heal:=.25;result_text:='대성공 · 안전한 자리를 찾아 충분히 회복했습니다.';
     elsif outcome='success' then heal:=.15;result_text:='성공 · 짧게 숨을 고르고 체력을 회복했습니다.';
     else damage:=8;result_text:='실패 · 무너진 잔해에 다쳐 오히려 체력을 잃었습니다.';end if;
   elsif id='common_cache' then
     if outcome='great' then r.potion_standard:=coalesce(r.potion_standard,0)+1;r.potion_lesser:=coalesce(r.potion_lesser,0)+1;result_text:='대성공 · 손상되지 않은 포션 두 병을 찾아냈습니다.';
     elsif outcome='success' then r.potion_lesser:=coalesce(r.potion_lesser,0)+1;result_text:='성공 · 하급 회복 포션을 챙겼습니다.';
     else damage:=12;result_text:='실패 · 상자 안쪽의 함정이 작동해 부상을 입었습니다.';end if;
   elsif id like 'resource_gather_%' then
     if outcome='great' then mat:=5;silver:=15;result_text:='대성공 · 상태 좋은 자원과 은화를 함께 확보했습니다.';
     elsif outcome='success' then mat:=3;result_text:='성공 · 쓸 만한 자원을 확보했습니다.';
     else
       damage:=case r.tower when 'ore' then 14 else 0 end;
       effect:=case r.tower when 'leather' then 'fang_wound' when 'gem' then 'crystal_fracture' when 'kaleon' then 'kaleon_blight' end;
       result_text:='실패 · 채집 과정에서 피해를 입었습니다.';
     end if;
   elsif id='common_risk' then
     if outcome='great' then silver:=50;result_text:='대성공 · 숨겨진 은화 꾸러미를 발견했습니다.';
     elsif outcome='success' then silver:=25;result_text:='성공 · 틈새에서 은화를 찾아냈습니다.';
     else damage:=18;result_text:='실패 · 틈새가 무너지며 크게 다쳤습니다.';end if;
   elsif id='common_remedy' then
     if outcome='great' then heal:=.15;result_text:='대성공 · 오염이 가라앉고 몸 상태까지 회복되었습니다.';
     elsif outcome='success' then heal:=.05;result_text:='성공 · 몸에 남은 독기와 오염이 옅어졌습니다.';
     else effect:='weaken';result_text:='실패 · 자극성 기체를 들이마셔 방어가 약해졌습니다.';end if;
   end if;
 else result_text:='위험을 피하고 탐사를 계속합니다.';end if;

 hp:=greatest(0,least(maxhp,hp+floor(maxhp*heal)::bigint-damage));
 if heal>0 then lines:=lines||jsonb_build_array('HP 회복');end if;
 if damage>0 then lines:=lines||jsonb_build_array('HP -'||damage::text);end if;
 if silver>0 then lines:=lines||jsonb_build_array('Silver +'||silver::text||' · 원정 임시 보관');end if;
 if mat>0 then lines:=lines||jsonb_build_array('재료 +'||mat::text||' · 원정 임시 보관');end if;

 if effect is not null then
   c.player_effects:=private.apply_server_effect(coalesce(c.player_effects,'[]'::jsonb),effect,c.player_turn);
   c.player_effects:=(select coalesce(jsonb_agg(case when x->>'effectId'=effect then jsonb_set(x,'{scope}','"EXPEDITION"'::jsonb,true) else x end),'[]'::jsonb)
                     from jsonb_array_elements(c.player_effects)x);
 end if;
 if id='common_remedy' and outcome in('great','success') then
   c.player_effects:=(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(c.player_effects,'[]'::jsonb))x
                     where x->>'effectId' not in('poison','kaleon_blight'));
 end if;
 r.temporary_loot:=jsonb_set(jsonb_set(coalesce(r.temporary_loot,'{}'::jsonb),'{silver}',
   to_jsonb(coalesce((r.temporary_loot->>'silver')::int,0)+silver),true),'{material}',
   to_jsonb(coalesce((r.temporary_loot->>'material')::int,0)+mat),true);
 e:=e||jsonb_build_object('state','RESULT','choiceId',choice,'outcomeId',outcome,'resultText',result_text,
    'resultLines',lines,'next','NORMAL');

 update private.online_expeditions set pending_event=e,temporary_loot=r.temporary_loot,
   potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,run_version=run_version+1
 where user_id=u returning * into r;
 update private.online_combat_states set player_hp=hp,player_effects=coalesce(c.player_effects,'[]'::jsonb),
   potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,
   pending_revival=(hp=0 and coalesce(r.revival_count,0)>0),
   phase=case when hp=0 then 'PLAYER_DEAD' else phase end,state_version=state_version+1,updated_at=now()
 where user_id=u;
 perform private.persist_run_bag_to_save(u,r);
 return jsonb_build_object('eventId',id,'choiceId',choice,'outcomeId',outcome,'playerHp',hp,
   'temporaryLoot',r.temporary_loot,'pendingEvent',e,'runVersion',r.run_version,
   'pendingRevival',(hp=0 and coalesce(r.revival_count,0)>0));
end $$;
revoke all on function public.resolve_online_exploration_event(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.resolve_online_exploration_event(uuid,bigint,text,text,bigint,text) to authenticated;

create or replace function public.claim_online_resource_stronghold(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;e jsonb;sh jsonb;started timestamptz:=clock_timestamp();seq bigint;expires bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 e:=r.pending_event;
 if e is null or coalesce(e->>'eventId',e->>'id')<>'resource_stronghold' or coalesce(e->>'state','CHOICE')<>'CHOICE'
 then raise exception 'RESOURCE_STRONGHOLD_EVENT_MISSING';end if;
 expires:=coalesce((e->>'expiresAt')::bigint,0);
 if expires>0 and round(extract(epoch from clock_timestamp())*1000)::bigint>=expires then raise exception 'RESOURCE_STRONGHOLD_DECISION_EXPIRED';end if;
 if r.floor<3 or r.floor>10 then raise exception 'RESOURCE_STRONGHOLD_FLOOR_INVALID';end if;
 if r.stronghold is not null and r.stronghold->>'status' in('ACTIVE','CONTESTED') then raise exception 'RESOURCE_STRONGHOLD_ALREADY_ACTIVE';end if;
 seq:=r.stronghold_sequence+1;
 sh:=jsonb_build_object('instanceId','stronghold-'||r.run_id::text||'-'||seq,'status','ACTIVE','tower',r.tower,'floor',r.floor,
   'version',1,'captureStartedAt',started,'captureEndsAt',started+interval '15 minutes','reward',private.stronghold_reward(r.tower,r.floor));
 e:=e||jsonb_build_object('state','RESULT','choiceId','claim','outcomeId',null,
   'resultText','자원거점 점령을 시작했습니다.','resultLines','[]'::jsonb,'next','NORMAL');
 update private.online_expeditions set stronghold=sh,stronghold_sequence=seq,pending_event=e,run_version=run_version+1
 where user_id=u returning * into r;
 return jsonb_build_object('stronghold',r.stronghold,'pendingEvent',e,'runVersion',r.run_version);
end $$;
revoke all on function public.claim_online_resource_stronghold(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.claim_online_resource_stronghold(uuid,bigint,text,text,bigint) to authenticated;

create or replace function public.abandon_online_resource_stronghold(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;sh jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 sh:=r.stronghold;if sh is null or sh->>'status'<>'ACTIVE' then raise exception 'RESOURCE_STRONGHOLD_NOT_ACTIVE';end if;
 sh:=sh||jsonb_build_object('status','DELETED','abandonedAt',clock_timestamp(),'deletedAt',clock_timestamp(),
   'version',coalesce((sh->>'version')::int,1)+2);
 update private.online_expeditions set stronghold=sh,run_version=run_version+1 where user_id=u returning * into r;
 update private.online_combat_states set return_authorized=true,state_version=state_version+1 where user_id=u and run_id=r.run_id;
 return jsonb_build_object('stronghold',r.stronghold,'returnAuthorized',true,'runVersion',r.run_version);
end $$;
revoke all on function public.abandon_online_resource_stronghold(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.abandon_online_resource_stronghold(uuid,bigint,text,text,bigint) to authenticated;

create or replace function public.restore_online_expedition(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u;
 if not found or r.status<>'ACTIVE' then return jsonb_build_object('active',false);end if;
 r:=private.ensure_run_consumables(u,r);
 select * into c from private.online_combat_states where user_id=u and run_id=r.run_id;
 return jsonb_build_object('active',true,
 'run',jsonb_build_object(
   'runId',r.run_id,'tower',r.tower,'floor',r.floor,'confirmedKills',r.confirmed_kills,
   'encounterIndex',r.encounter_index,'bossProgress',r.boss_progress,'bossDefeated',r.boss_defeated,
   'pendingEvent',r.pending_event,'temporaryLoot',r.temporary_loot,'stronghold',r.stronghold,'runVersion',r.run_version,
   'potions',jsonb_build_object('lesser',r.potion_lesser,'standard',r.potion_standard,'greater',r.potion_greater,
      'supreme',r.potion_supreme,'revival',r.revival_count)),
 'combat',case when c.user_id is null then null else jsonb_build_object(
   'encounterIndex',c.encounter_index,'monsterId',c.monster_id,'monsterHp',c.monster_hp,'monsterMaxHp',c.monster_max_hp,
   'monsterAttack',c.monster_attack,'monsterDefense',c.monster_defense,
   'playerHp',c.player_hp,'playerMaxHp',c.player_max_hp,'playerShield',c.player_shield,'monsterShield',c.monster_shield,
   'playerShieldHits',c.player_shield_hits,'monsterShieldHits',c.monster_shield_hits,
   'playerEffects',c.player_effects,'monsterEffects',c.monster_effects,'monsterCooldowns',c.monster_cooldowns,
   'monsterPreparedAction',c.monster_prepared_action,'monsterReactiveAction',c.monster_reactive_action,
   'jobId',c.job_id,'jobResource',c.job_resource,'jobFlags',c.job_flags,'playerCooldowns',c.cooldowns,
   'stateVersion',c.state_version,'playerTurn',c.player_turn,'monsterTurn',c.monster_turn,'turnNo',c.turn_no,
   'phase',c.phase,'pendingRevival',c.pending_revival,'actionNonce',c.action_nonce,'returnAuthorized',c.return_authorized
 ) end);
end $$;
revoke all on function public.restore_online_expedition(uuid,bigint,text,text) from public,anon;
grant execute on function public.restore_online_expedition(uuid,bigint,text,text) to authenticated;
