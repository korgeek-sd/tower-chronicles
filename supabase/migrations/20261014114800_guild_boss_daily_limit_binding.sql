-- Fix PL/pgSQL daily attack-limit variable ambiguity; preserve atomic server checks.
CREATE OR REPLACE FUNCTION public.attack_guild_boss(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;aid uuid;s public.game_saves%rowtype;entry private.guild_boss_encounters%rowtype;
 previous private.guild_boss_attacks%rowtype;used_count integer;v_attack_day date;combat jsonb;dealt bigint;outcome jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'GUILD_BOSS_REQUEST_REQUIRED';end if;
 if p_kind not in ('DAILY','WEEKLY') or p_kind is null then raise exception 'GUILD_BOSS_KIND_INVALID';end if;
 -- Save lock precedes guild lock, matching other economy operations and protecting equipment snapshots.
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=u;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into previous from private.guild_boss_attacks where user_id=u and request_id=p_request_id;
 if found then
  if not exists(select 1 from private.guild_boss_encounters e where e.encounter_id=previous.encounter_id and e.association_id=aid and e.kind=p_kind)
  then raise exception 'GUILD_BOSS_REQUEST_CONFLICT';end if;
  return jsonb_build_object('result',previous.result,'state',private.guild_boss_state_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
  or coalesce(s.payload->>'expedition','null')<>'null' then raise exception 'GUILD_BOSS_EXPEDITION_ACTIVE';end if;
 entry:=private.guild_boss_ensure(aid,p_kind,now());
 select * into entry from private.guild_boss_encounters where encounter_id=entry.encounter_id for update;
 if entry.defeated_at is not null or entry.remaining_hp<=0 then raise exception 'GUILD_BOSS_DEFEATED';end if;
 if now()>=entry.cycle_end then raise exception 'GUILD_BOSS_EXPIRED';end if;
 v_attack_day:=(now() at time zone 'Asia/Seoul')::date;
 select count(*) into used_count from private.guild_boss_attacks t
 where t.encounter_id=entry.encounter_id and t.user_id=u and t.day_kst=v_attack_day;
 if used_count>=5 then raise exception 'GUILD_BOSS_ATTACK_LIMIT';end if;
 combat:=private.guild_boss_combat(u,entry,s.payload);
 dealt:=greatest(0,least(entry.remaining_hp,coalesce((combat->>'damage')::bigint,0)));
 update private.guild_boss_encounters
  set remaining_hp=remaining_hp-dealt,total_attacks=total_attacks+1,
   defeated_at=case when remaining_hp-dealt=0 then now() else null end
  where encounter_id=entry.encounter_id;
 outcome:=jsonb_build_object('encounterId',entry.encounter_id,'kind',p_kind,'name',entry.boss_name,
    'damage',dealt,'remainingHp',entry.remaining_hp-dealt,'maxHp',entry.max_hp,
    'defeated',entry.remaining_hp-dealt=0,'attacksLeft',4-used_count,'combat',combat,'createdAt',now());
 insert into private.guild_boss_attacks(encounter_id,user_id,request_id,day_kst,damage,result)
 values(entry.encounter_id,u,p_request_id,v_attack_day,dealt,outcome);
 perform private.broadcast_association_change(aid);
 return jsonb_build_object('result',outcome,'state',private.guild_boss_state_json(u),'replayed',false);
end;$function$;
