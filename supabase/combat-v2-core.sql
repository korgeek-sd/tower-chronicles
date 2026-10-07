-- V2 private primitives. No helper can be called directly by game clients.
alter table private.online_combat_states add column if not exists engine_runtime jsonb not null default '{}';
alter table private.online_expeditions add column if not exists healing_potion_uses integer not null default 0 check(healing_potion_uses between 0 and 5);
alter table private.online_combat_states alter column player_hp type numeric,alter column monster_hp type numeric;

create or replace function private.combat_v2_damage(a numeric,d numeric,m numeric default 1,crit numeric default 1,received numeric default 1,penetration numeric default 0)
returns bigint language sql immutable set search_path='' as $$
 select greatest(1,floor(greatest(1,floor(a*m*100/(100+greatest(0,d)*(1-greatest(0,least(1,penetration))))*crit))*greatest(0,received)))::bigint;
$$;
create or replace function private.combat_damage(p_attack numeric,p_defense numeric,p_multiplier numeric default 1,p_critical numeric default 1,p_received numeric default 1)
returns bigint language sql immutable set search_path='' as $$ select private.combat_v2_damage(p_attack,p_defense,p_multiplier,p_critical,p_received,0); $$;

create or replace function private.combat_v2_definition(id text) returns jsonb language sql immutable set search_path='' as $$ select private.combat_v2_catalog()->'effects'->id; $$;
create or replace function private.combat_v2_modifier(effects jsonb,stat text) returns numeric language sql immutable set search_path='' as $$
 select coalesce(sum(coalesce((private.combat_v2_definition(x->>'effectId')->'payload'->>'multiplier')::numeric,(x->>'multiplier')::numeric,0)*case when x->>'effectId' like 'test_%' then coalesce((x->>'stacks')::int,1) else 1 end),0)
 from jsonb_array_elements(coalesce(effects,'[]'))x where coalesce(private.combat_v2_definition(x->>'effectId')->'payload'->>'stat',x->>'stat')=stat;
$$;
create or replace function private.effect_modifier(p_effects jsonb,p_stat text) returns numeric language sql immutable set search_path='' as $$ select private.combat_v2_modifier(p_effects,p_stat); $$;
create or replace function private.combat_v2_has(effects jsonb,tag text) returns boolean language sql immutable set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(coalesce(effects,'[]'))x where x->>'effectId'=tag or coalesce(private.combat_v2_definition(x->>'effectId')->'tags','[]') ? tag);
$$;
create or replace function private.combat_v2_shield(effects jsonb) returns numeric language sql immutable set search_path='' as $$ select coalesce(sum(coalesce((x->>'currentShield')::numeric,0)),0) from jsonb_array_elements(coalesce(effects,'[]'))x; $$;

create or replace function private.combat_v2_apply_effect(effects jsonb,id text,turn_no bigint,max_hp numeric,source text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare d jsonb:=private.combat_v2_definition(id);old jsonb;created jsonb;duration int;amount numeric;seq bigint;
begin
 if d is null then return coalesce(effects,'[]');end if;
 select x into old from jsonb_array_elements(coalesce(effects,'[]'))x where x->>'effectId'=id limit 1;
 duration:=coalesce((d->>'defaultDuration')::int,1);
 if d->>'behavior'='SHIELD' then
  amount:=least(coalesce((d->>'shieldAmount')::numeric,round(max_hp*(d->>'shieldPercent')::numeric),0),greatest(0,3*max_hp-private.combat_v2_shield(effects)));
  if amount<=0 then return coalesce(effects,'[]');end if;
  if old is not null then created:=old||jsonb_build_object('currentShield',coalesce((old->>'currentShield')::numeric,0)+amount);
  else created:=jsonb_build_object('effectId',id,'duration',duration,'stacks',1,'createdTurn',turn_no,'behavior','SHIELD','currentShield',amount,'sourceActorId',source);end if;
 elsif old is not null then
  created:=old||jsonb_build_object('duration',coalesce((old->>'duration')::int,0)+duration,'stacks',1,'applications',coalesce((old->>'applications')::int,(old->>'stacks')::int,1)+1);
 else
  created:=jsonb_build_object('effectId',id,'duration',duration,'stacks',1,'applications',1,'createdTurn',turn_no,'behavior',d->>'behavior','sourceActorId',source)||coalesce(d->'payload','{}');
 end if;
 if old is not null then return (select jsonb_agg(case when x->>'effectId'=id then created else x end order by ord) from jsonb_array_elements(coalesce(effects,'[]')) with ordinality t(x,ord));end if;
 select coalesce(max(coalesce((x->>'applicationSequence')::bigint,0)),0)+1 into seq from jsonb_array_elements(coalesce(effects,'[]'))x;
 return coalesce(effects,'[]')||jsonb_build_array(created||jsonb_build_object('applicationSequence',seq));
end $$;
create or replace function private.apply_server_effect(p_effects jsonb,p_id text,p_turn bigint) returns jsonb language sql immutable set search_path='' as $$ select private.combat_v2_apply_effect(p_effects,p_id,p_turn,1000000,'monster'); $$;

create or replace function private.combat_v2_tick(effects jsonb,turn_no bigint) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(x||jsonb_build_object('duration',case when x->>'behavior'='SHIELD' or coalesce((x->>'createdTurn')::bigint,-1)=turn_no then (x->>'duration')::int else (x->>'duration')::int-1 end) order by ord),'[]')
 from jsonb_array_elements(coalesce(effects,'[]')) with ordinality t(x,ord)
 where x->>'behavior'='SHIELD' or (x->>'duration')::int-case when coalesce((x->>'createdTurn')::bigint,-1)=turn_no then 0 else 1 end>0;
$$;
create or replace function private.effect_tick(p_effects jsonb,p_turn bigint) returns jsonb language sql immutable set search_path='' as $$ select private.combat_v2_tick(p_effects,p_turn); $$;

create or replace function private.combat_v2_event(c private.online_combat_states,event jsonb) returns private.online_combat_states language plpgsql immutable set search_path='' as $$
begin c.engine_runtime:=coalesce(c.engine_runtime,'{}')||jsonb_build_object('events',coalesce(c.engine_runtime->'events','[]')||jsonb_build_array(event));return c;end $$;
create or replace function private.combat_v2_heal(c private.online_combat_states,actor text,amount numeric,can_crit boolean,nonce bigint,salt int,source text default 'player')
returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare src jsonb:=case when source='player' then c.player_effects else c.monster_effects end;dst jsonb:=case when actor='player' then c.player_effects else c.monster_effects end;critical boolean;healed numeric;
begin
 if (actor='player' and c.player_hp<=0) or (actor='monster' and c.monster_hp<=0) then return c;end if;
 critical:=can_crit and private.server_roll(c.rng_seed,c.encounter_index,nonce,salt)<greatest(0,least(1,case when source='player' then coalesce(c.crit_chance,.05) else 0 end+private.combat_v2_modifier(src,'healCritChance')));
 healed:=greatest(0,amount)*greatest(0,1+private.combat_v2_modifier(src,'healingDone'))*greatest(0,1+private.combat_v2_modifier(dst,'healingReceived'))*case when critical then greatest(1,coalesce(c.crit_damage,1.5)+private.combat_v2_modifier(src,'healCritDamage')) else 1 end;
 if actor='player' then c.player_hp:=c.player_hp+healed;else c.monster_hp:=c.monster_hp+healed;end if;
 if healed>0 then c:=private.combat_v2_event(c,jsonb_build_object('kind','HEAL','attacker',source,'target',actor,'healing',healed,'critical',critical,'hpDamage',0,'incomingDamage',0,'absorbedByShield',0,'hitIndex',1,'hitCount',1));end if;
 return c;
end $$;
create or replace function private.combat_v2_periodic(c private.online_combat_states,actor text,nonce bigint)
returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare effects jsonb:=case when actor='player' then c.player_effects else c.monster_effects end;turn_no bigint:=case when actor='player' then c.player_turn else c.monster_turn end;max_hp numeric:=case when actor='player' then c.player_max_hp else c.monster_max_hp end;x jsonb;d jsonb;amount numeric;idx int:=1200;
begin
 for x in select value from jsonb_array_elements(coalesce(effects,'[]')) where coalesce((value->>'createdTurn')::bigint,-1)<>turn_no loop
  d:=coalesce(private.combat_v2_definition(x->>'effectId'),x);
  if d->>'behavior'='PERIODIC_DAMAGE' then
   amount:=coalesce((d->'payload'->>'amount')::numeric,(x->>'amount')::numeric,0);
   if actor='player' then c.player_hp:=greatest(0,c.player_hp-amount);else c.monster_hp:=greatest(0,c.monster_hp-amount);end if;
  end if;
 end loop;
 if (actor='player' and c.player_hp<=0) or (actor='monster' and c.monster_hp<=0) then return c;end if;
 for x in select value from jsonb_array_elements(coalesce(effects,'[]')) where coalesce((value->>'createdTurn')::bigint,-1)<>turn_no loop
  d:=coalesce(private.combat_v2_definition(x->>'effectId'),x);
  if d->>'behavior'='PERIODIC_HEAL' then
   idx:=idx+1;c:=private.combat_v2_heal(c,actor,max_hp*coalesce((d->'payload'->>'amount')::numeric,(x->>'amount')::numeric,0),coalesce(x->>'sourceActorId','monster')='player',nonce,idx,coalesce(x->>'sourceActorId','monster'));
  end if;
 end loop;
 return c;
end $$;

-- Each user's row is reused across expeditions. Reset the allowance on run identity change.
create or replace function private.combat_v2_reset_potion_allowance()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' or new.run_id is distinct from old.run_id then new.healing_potion_uses:=0;end if;
 return new;
end $$;
drop trigger if exists combat_v2_reset_potion_allowance on private.online_expeditions;
create trigger combat_v2_reset_potion_allowance before insert or update of run_id
on private.online_expeditions for each row execute function private.combat_v2_reset_potion_allowance();
