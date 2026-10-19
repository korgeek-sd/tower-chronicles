CREATE OR REPLACE FUNCTION private.refresh_hunting_state(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s private.hunting_states%rowtype;ticks integer;stamp timestamptz:=now();
begin
 insert into private.hunting_states(user_id) values(u) on conflict(user_id) do nothing;
 select * into s from private.hunting_states where user_id=u for update; if s.active_skill_set>0 and not private.premium_active(u) then s.skill_sets:=private.hunting_skill_set_bank(s.skills,s.skill_setup,s.skill_sets,s.active_skill_set);s.active_skill_set:=0;s.skill_setup:=s.skill_sets->0->'setup';select coalesce(array_agg(value order by ord),array[]::text[]) into s.skills from jsonb_array_elements_text(s.skill_sets->0->'skills') with ordinality x(value,ord);update private.hunting_states set skill_sets=s.skill_sets,active_skill_set=0,skills=s.skills,skill_setup=s.skill_setup where user_id=u;end if;
 ticks:=floor(greatest(0,extract(epoch from stamp-s.recovered_at))/300)::integer;
 s.vitality:=case when s.vitality>=100 then s.vitality else least(100,s.vitality+ticks) end;
 s.recovered_at:=case when s.vitality>=100 then greatest(stamp,s.recovered_at) else s.recovered_at+ticks*interval '300 seconds' end;
 update private.hunting_states set vitality=s.vitality,recovered_at=s.recovered_at where user_id=u;
 return jsonb_build_object('premiumActive',private.premium_active(u),'vitality',s.vitality,'recoveredAt',extract(epoch from s.recovered_at)*1000,'experience',s.experience,'mastery',s.mastery,'skills',to_jsonb(s.skills),'skillSetup',s.skill_setup,'skillSets',private.hunting_skill_set_bank(s.skills,s.skill_setup,s.skill_sets,s.active_skill_set),'activeSkillSet',s.active_skill_set,'lastResult',s.last_result,'combatStats',private.combat_equipment_stats(u,(select jsonb_set(payload,'{expedition}',jsonb_build_object('equipment',payload->'equipped'),true) from public.game_saves where user_id=u)),'statAllocation',s.stat_allocation,'statResets',s.stat_resets,'statPoints',greatest(0,private.hunting_level(s.experience)-1-coalesce((s.stat_allocation->>'hp')::integer,0)-coalesce((s.stat_allocation->>'attack')::integer,0)-coalesce((s.stat_allocation->>'defense')::integer,0)-coalesce((s.stat_allocation->>'crit')::integer,0)-coalesce((s.stat_allocation->>'mp')::integer,0)),'currentHp',s.current_hp,'maxHp',s.max_hp,'currentMp',s.current_mp,'maxMp',100+10*coalesce((s.stat_allocation->>'mp')::integer,0),'potions',coalesce((select (l.products->>'potion')::bigint from private.village_life_players l where l.user_id=u),0),'foodTurns',coalesce((select l.food_turns from private.village_life_players l where l.user_id=u),'{}'::jsonb));
end $function$

