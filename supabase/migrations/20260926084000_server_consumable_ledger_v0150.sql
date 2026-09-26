-- v0.1.50 persist consumables on the canonical server expedition, not per encounter.
alter table private.online_expeditions
 add column if not exists potion_lesser integer,
 add column if not exists potion_standard integer,
 add column if not exists potion_greater integer,
 add column if not exists potion_supreme integer,
 add column if not exists revival_count integer;

create or replace function private.ensure_run_consumables(p_user uuid,p_run private.online_expeditions)
returns private.online_expeditions language plpgsql security definer set search_path=''
as $$
declare r private.online_expeditions%rowtype;s public.game_saves%rowtype;b jsonb;
begin
 r:=p_run;
 if r.potion_lesser is not null then return r;end if;
 select * into s from public.game_saves where user_id=p_user for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 b:=coalesce(s.payload->'expedition'->'bag','{}'::jsonb);
 update private.online_expeditions set
  potion_lesser=greatest(0,coalesce((b->>'healing_lesser')::int,0)),
  potion_standard=greatest(0,coalesce((b->>'healing_standard')::int,0)),
  potion_greater=greatest(0,coalesce((b->>'healing_greater')::int,0)),
  potion_supreme=greatest(0,coalesce((b->>'healing_supreme')::int,0)),
  revival_count=greatest(0,least(1,coalesce((b->>'revival')::int,0)))
 where user_id=p_user returning * into r;
 return r;
end $$;
revoke all on function private.ensure_run_consumables(uuid,private.online_expeditions) from public,anon,authenticated;

create or replace function private.persist_run_bag_to_save(p_user uuid,p_run private.online_expeditions)
returns void language plpgsql security definer set search_path=''
as $$
declare s public.game_saves%rowtype;p jsonb;b jsonb;
begin
 select * into s from public.game_saves where user_id=p_user for update;
 if not found or jsonb_typeof(s.payload->'expedition')<>'object' then return;end if;
 p:=s.payload;b:=coalesce(p->'expedition'->'bag','{}'::jsonb);
 b:=jsonb_set(b,'{healing_lesser}',to_jsonb(greatest(0,coalesce(p_run.potion_lesser,0))),true);
 b:=jsonb_set(b,'{healing_standard}',to_jsonb(greatest(0,coalesce(p_run.potion_standard,0))),true);
 b:=jsonb_set(b,'{healing_greater}',to_jsonb(greatest(0,coalesce(p_run.potion_greater,0))),true);
 b:=jsonb_set(b,'{healing_supreme}',to_jsonb(greatest(0,coalesce(p_run.potion_supreme,0))),true);
 b:=jsonb_set(b,'{revival}',to_jsonb(greatest(0,coalesce(p_run.revival_count,0))),true);
 p:=jsonb_set(p,'{expedition,bag}',b,true);
 update public.game_saves set payload=p,payload_hash=encode(extensions.digest(convert_to(p::text,'UTF8'),'sha256'),'hex'),updated_at=now() where user_id=p_user;
end $$;
revoke all on function private.persist_run_bag_to_save(uuid,private.online_expeditions) from public,anon,authenticated;

create or replace function public.apply_online_potion(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_potion text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;ratio numeric;cnt int;heal bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 r:=private.ensure_run_consumables(u,r);
 select * into c from private.online_combat_states where user_id=u for update;
 if not found or c.run_id<>r.run_id or c.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;
 if p_action_nonce<>c.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 select x.ratio,case p_potion when 'healing_lesser' then r.potion_lesser when 'healing_standard' then r.potion_standard when 'healing_greater' then r.potion_greater when 'healing_supreme' then r.potion_supreme end into ratio,cnt
 from (values('healing_lesser'::text,.2::numeric),('healing_standard',.35),('healing_greater',.5),('healing_supreme',.75))x(id,ratio) where x.id=p_potion;
 if not found or coalesce(cnt,0)<1 or c.player_hp>=c.player_max_hp then raise exception 'COMBAT_POTION_INVALID';end if;
 heal:=round(c.player_max_hp*ratio);c.player_hp:=least(c.player_max_hp,c.player_hp+heal);
 update private.online_expeditions set
  potion_lesser=potion_lesser-case when p_potion='healing_lesser' then 1 else 0 end,
  potion_standard=potion_standard-case when p_potion='healing_standard' then 1 else 0 end,
  potion_greater=potion_greater-case when p_potion='healing_greater' then 1 else 0 end,
  potion_supreme=potion_supreme-case when p_potion='healing_supreme' then 1 else 0 end
 where user_id=u returning * into r;
 update private.online_combat_states set player_hp=c.player_hp,potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,potion_greater=r.potion_greater,potion_supreme=r.potion_supreme,action_nonce=p_action_nonce,updated_at=now() where user_id=u;
 perform private.persist_run_bag_to_save(u,r);
 return jsonb_build_object('healing',heal,'playerHp',c.player_hp,'monsterHp',c.monster_hp,'phase','PLAYER_TURN','confirmedKills',r.confirmed_kills,'actionNonce',p_action_nonce,'potions',jsonb_build_object('healing_lesser',r.potion_lesser,'healing_standard',r.potion_standard,'healing_greater',r.potion_greater,'healing_supreme',r.potion_supreme));
end $$;
revoke all on function public.apply_online_potion(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.apply_online_potion(uuid,bigint,text,text,bigint,text) to authenticated;

create or replace function public.resolve_online_revival(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_use boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;hp bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;if not found then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;r:=private.ensure_run_consumables(u,r);
 select * into c from private.online_combat_states where user_id=u for update;
 if not found or c.run_id<>r.run_id or not c.pending_revival or c.player_hp<>0 then raise exception 'COMBAT_REVIVAL_INVALID';end if;
 if not p_use then update private.online_combat_states set pending_revival=false,phase='PLAYER_DEAD',updated_at=now() where user_id=u;return jsonb_build_object('playerHp',0,'monsterHp',c.monster_hp,'phase','PLAYER_DEAD','pendingRevival',false,'actionNonce',c.action_nonce);end if;
 if coalesce(r.revival_count,0)<1 then raise exception 'COMBAT_REVIVAL_INVALID';end if;
 hp:=greatest(1,round(c.player_max_hp*.3)::bigint);
 update private.online_expeditions set revival_count=revival_count-1 where user_id=u returning * into r;
 update private.online_combat_states set player_hp=hp,revival_count=r.revival_count,pending_revival=false,phase='PLAYER_TURN',updated_at=now() where user_id=u;
 perform private.persist_run_bag_to_save(u,r);
 return jsonb_build_object('playerHp',hp,'monsterHp',c.monster_hp,'phase','PLAYER_TURN','pendingRevival',false,'actionNonce',c.action_nonce,'revivalCount',r.revival_count);
end $$;
revoke all on function public.resolve_online_revival(uuid,bigint,text,text,boolean) from public,anon;
grant execute on function public.resolve_online_revival(uuid,bigint,text,text,boolean) to authenticated;


create or replace function public.begin_online_combat_state_v2(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;s public.game_saves%rowtype;r private.online_expeditions%rowtype;result jsonb;power numeric;passive jsonb;j text;
begin
 result:=public.begin_online_combat_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,null,null,null);
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;if not found then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;r:=private.ensure_run_consumables(u,r);
 select * into s from public.game_saves where user_id=u;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 power:=private.combat_skill_power(s.payload);passive:=private.combat_accessory_passive(s.payload);j:=private.server_job_id(s.payload);
 update private.online_combat_states set skill_power=power,revival_count=r.revival_count,potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,potion_greater=r.potion_greater,potion_supreme=r.potion_supreme,
 accessory_passive=passive->>'kind',accessory_value=coalesce((passive->>'value')::numeric,0),job_id=j,job_resource=case when j='berserker' then job_resource else 0 end,state_version=state_version+1 where user_id=u;
 return result||(select jsonb_build_object('jobId',job_id,'jobResource',job_resource,'stateVersion',state_version,'playerEffects',player_effects,'monsterEffects',monster_effects,'playerShield',player_shield,'monsterShield',monster_shield,'revivalCount',revival_count,'potions',jsonb_build_object('healing_lesser',potion_lesser,'healing_standard',potion_standard,'healing_greater',potion_greater,'healing_supreme',potion_supreme)) from private.online_combat_states where user_id=u);
end $$;
revoke all on function public.begin_online_combat_state_v2(uuid,bigint,text,text) from public,anon;
grant execute on function public.begin_online_combat_state_v2(uuid,bigint,text,text) to authenticated;
