-- Preserve all existing authorization, locking, receipts and battle scheduling.
alter table private.village_war_fronts add column defense_wins integer not null default 0 check(defense_wins>=0);

create function private.village_war_fatigue_defeat(wins integer, roll double precision) returns boolean
language sql immutable strict set search_path='' as $$ select wins>=20 and roll<0.30 $$;
revoke all on function private.village_war_fatigue_defeat(integer,double precision) from public,anon,authenticated;

create table private.association_rejoin_cooldowns(
 user_id uuid primary key references auth.users(id) on delete cascade,
 rejoin_at timestamptz not null
);
alter table private.association_rejoin_cooldowns enable row level security;
revoke all on private.association_rejoin_cooldowns from public,anon,authenticated;

create function private.association_rejoin_guard() returns trigger
language plpgsql set search_path='' as $guard$
declare uid uuid; deadline timestamptz;
begin
 if TG_OP='DELETE' then
  uid:=old.user_id;
 else
  if TG_TABLE_NAME='online_association_applications' then uid:=new.applicant_user_id;
  else uid:=new.user_id; end if;
 end if;
 if not pg_try_advisory_xact_lock(hashtextextended('association-rejoin:'||uid::text,0)) then raise exception 'ASSOCIATION_MEMBERSHIP_BUSY'; end if;
 if TG_OP='DELETE' then
  if exists(select 1 from auth.users where id=uid) then
   insert into private.association_rejoin_cooldowns(user_id,rejoin_at)
   values(uid,clock_timestamp()+interval '72 hours')
   on conflict(user_id) do update set rejoin_at=greatest(private.association_rejoin_cooldowns.rejoin_at,excluded.rejoin_at);
  end if;
  return old;
 end if;
 select rejoin_at into deadline from private.association_rejoin_cooldowns where user_id=uid;
 if deadline>clock_timestamp() then raise exception 'ASSOCIATION_REJOIN_COOLDOWN' using detail=deadline::text; end if;
 return new;
end $guard$;
revoke all on function private.association_rejoin_guard() from public,anon,authenticated;
create trigger association_rejoin_after_leave after delete on private.online_association_members for each row execute function private.association_rejoin_guard();
create trigger association_rejoin_before_join before insert on private.online_association_members for each row execute function private.association_rejoin_guard();
create trigger association_rejoin_before_application before insert on private.online_association_applications for each row execute function private.association_rejoin_guard();

do $patch$
declare d text; old_d text;
begin
 select pg_get_functiondef('public.attack_village_war_front(uuid,bigint,text,text,uuid,text,integer,bigint,uuid)'::regprocedure) into d;
 old_d:=d;
 if strpos(d,'reward int:=0;win boolean;target uuid;')=0 or strpos(d,'if private.village_war_random()<.5 then')=0 or strpos(d,'set event_id=null,front_id=null where user_id=target and event_id=eid and front_id=p_front_id;')=0 or strpos(d,'set hp=(battle->>''defenderHp'')::numeric,mp=(battle->>''defenderMp'')::numeric,revision=revision+1')=0 or strpos(d,'defender_epoch=defender_epoch+1,revision=revision+1')=0 or strpos(d,'battle:=battle||jsonb_build_object(''defenderReward'',reward);')=0 then raise exception 'WAR_ATTACK_BASELINE_CHANGED';end if;
 d:=replace(d,'reward int:=0;win boolean;target uuid;','reward int:=0;win boolean;target uuid;fatigue_defeat boolean:=false;');
 d:=replace(d,'win:=battle->>''outcome''=''CAPTURE'';','win:=battle->>''outcome''=''CAPTURE''; if not win and f.defense_wins>=20 then fatigue_defeat:=private.village_war_fatigue_defeat(f.defense_wins,private.village_war_random()); if fatigue_defeat then win:=true; battle:=battle||jsonb_build_object(''outcome'',''CAPTURE''); end if; end if;');
 d:=replace(d,'set event_id=null,front_id=null where user_id=target and event_id=eid and front_id=p_front_id;','set event_id=null,front_id=null,next_attack_at=greatest(coalesce(next_attack_at,stamp),stamp+interval ''30 seconds'') where user_id=target and event_id=eid and front_id=p_front_id;');
 d:=replace(d,'defender_epoch=defender_epoch+1,revision=revision+1','defense_wins=0,defender_epoch=defender_epoch+1,revision=revision+1');
 d:=replace(d,'set hp=(battle->>''defenderHp'')::numeric,mp=(battle->>''defenderMp'')::numeric,revision=revision+1','set hp=(battle->>''defenderHp'')::numeric,mp=(battle->>''defenderMp'')::numeric,defense_wins=defense_wins+1,revision=revision+1');
 d:=replace(d,'if private.village_war_random()<.5 then','if private.village_war_random()<.30 then');
 d:=replace(d,'battle:=battle||jsonb_build_object(''defenderReward'',reward);','battle:=battle||jsonb_build_object(''defenderReward'',reward,''fatigueDefeat'',fatigue_defeat,''defenseWins'',f.defense_wins+case when win then 0 else 1 end);');
 if strpos(d,'private.village_war_fatigue_defeat(f.defense_wins,')=0 then raise exception 'WAR_FATIGUE_PATCH_FAILED';end if;
 execute d;
 select pg_get_functiondef('private.village_war_mutate_stage_one(uuid,uuid,text,integer,bigint,text,uuid)'::regprocedure) into d;
 if strpos(d,'defender_epoch=defender_epoch+1,revision=revision+1')=0 then raise exception 'WAR_MUTATE_BASELINE_CHANGED';end if;
 execute replace(d,'defender_epoch=defender_epoch+1,revision=revision+1','defense_wins=0,defender_epoch=defender_epoch+1,revision=revision+1');
 select pg_get_functiondef('public.get_village_war_state_stage_one(uuid,bigint,text,text,text)'::regprocedure) into d;
 if strpos(d,'''occupiedAt'',f.occupied_at')=0 then raise exception 'WAR_STATE_BASELINE_CHANGED';end if;
 execute replace(d,'''occupiedAt'',f.occupied_at','''occupiedAt'',f.occupied_at,''defenseWins'',f.defense_wins');
 select pg_get_functiondef('private.online_association_state_json(uuid)'::regprocedure) into d;
 if strpos(d,'''myApplications'',v_my_apps')=0 then raise exception 'ASSOCIATION_STATE_BASELINE_CHANGED';end if;
 execute replace(d,'''myApplications'',v_my_apps','''myApplications'',v_my_apps,''rejoinAt'',(select rejoin_at from private.association_rejoin_cooldowns where user_id=p_user and rejoin_at>clock_timestamp()),''serverNow'',extract(epoch from clock_timestamp())*1000');
end $patch$;
do $verify$
begin
 if private.village_war_fatigue_defeat(19,0.0) or not private.village_war_fatigue_defeat(20,0.299) or private.village_war_fatigue_defeat(20,0.30) then raise exception 'WAR_FATIGUE_BOUNDARY_FAILED'; end if;
end $verify$;

