CREATE OR REPLACE FUNCTION private.server_job_damage_multiplier(p_combat private.online_combat_states, p_action text)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare r numeric:=p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0);m numeric:=p_combat.monster_hp::numeric/nullif(p_combat.monster_max_hp,0);x numeric:=1;
begin
 if p_combat.job_id='contract_mercenary' and p_action='BASIC' then x:=x*1.1;end if;
 if p_combat.job_id='hunter' then
  if exists(select 1 from jsonb_array_elements(p_combat.monster_effects)e where e->>'effectId'='hunter_mark') then x:=x*1.15;end if;
  if p_action='BASIC' and m<=.35 then x:=x*1.2;end if;
 elsif p_combat.job_id='duelist' then x:=x*1.1;
 elsif p_combat.job_id='berserker' then x:=x*(case when r<=.2 then 1.35 when r<=.4 then 1.2 when r<=.7 then 1.1 else 1 end);
 end if;
 return x;
end $function$;

CREATE OR REPLACE FUNCTION private.server_roll(p_seed bigint, p_encounter bigint, p_nonce bigint, p_hit integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select (abs(hashtextextended(p_seed::text||':'||p_encounter::text||':'||p_nonce::text||':'||p_hit::text,0))%1000000)::numeric/1000000
$function$;
