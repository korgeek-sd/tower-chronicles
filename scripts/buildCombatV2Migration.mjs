import {readFileSync,writeFileSync} from 'node:fs';
const parts=['supabase/combat-v2-catalog.sql','supabase/combat-v2-compat.sql','supabase/combat-v2-core.sql','supabase/combat-v2-actions.sql','supabase/combat-v2-rpc.sql','supabase/combat-v2-encounter.sql','supabase/combat-v2-restore.sql','supabase/combat-v2-cutover.sql'];
let sql=parts.map(p=>readFileSync(p,'utf8')).join('\n');
for(const signature of ['combat_v2_damage(numeric,numeric,numeric,numeric,numeric,numeric)','combat_v2_definition(text)','combat_v2_modifier(jsonb,text)','combat_v2_has(jsonb,text)','combat_v2_shield(jsonb)','combat_v2_apply_effect(jsonb,text,bigint,numeric,text)','combat_v2_tick(jsonb,bigint)','combat_v2_event(private.online_combat_states,jsonb)','combat_v2_heal(private.online_combat_states,text,numeric,boolean,bigint,integer,text)','combat_v2_periodic(private.online_combat_states,text,bigint)'])sql+=`\nrevoke all on function private.${signature} from public,anon,authenticated;\n`;
sql+=`
do $permissions$
declare fn regprocedure;begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'combat_v2_%' or p.proname in ('combat_damage','effect_modifier','apply_server_effect','effect_tick','server_roll','server_job_damage_multiplier','resolve_server_monster_turn_v2','finish_server_player_action','server_start_encounter')) loop execute format('revoke all on function %s from public,anon,authenticated',fn);end loop;
end $permissions$;
`;
for(const signature of ['apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric)','apply_online_job_skill(uuid,bigint,text,text,bigint,text)','apply_online_flee(uuid,bigint,text,text,bigint)','apply_online_potion(uuid,bigint,text,text,bigint,text)','resolve_online_revival(uuid,bigint,text,text,boolean)','begin_online_combat_state_v2(uuid,bigint,text,text)','restore_online_expedition(uuid,bigint,text,text)'])sql+=`\nrevoke all on function public.${signature} from public,anon;\ngrant execute on function public.${signature} to authenticated;\n`;
writeFileSync('supabase/migrations/20261003151110_combat_engine_v2_online.sql',sql);
