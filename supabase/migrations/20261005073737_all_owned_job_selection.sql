-- Expand selection only; preserve ownership, active-session and expedition guards.
DO $all_jobs$
DECLARE f oid; source text; patched text;
BEGIN
 SELECT p.oid INTO STRICT f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='select_online_job';
 source:=pg_get_functiondef(f);
 patched:=replace(source,'''contract_mercenary'',''hunter'',''field_medic'',''duelist'',''berserker'',''vanguard_explorer'',''tracker'',''survivor'',''expedition_medic'',''redeemer'',''lantern_keeper'',''relic_collector'',''monster_dismantler'',''expedition_archivist''','''contract_mercenary'',''hunter'',''excavator'',''field_medic'',''reclaimer'',''green_crown_pilgrim'',''porter'',''guide'',''vanguard_explorer'',''tracker'',''survivor'',''duelist'',''expedition_medic'',''redeemer'',''lantern_keeper'',''relic_collector'',''monster_dismantler'',''expedition_archivist'',''executor'',''inquisitor'',''deep_delver'',''bloodfighter'',''expedition_tactician'',''ascetic_priest'',''life_stitcher'',''subjugation_officer'',''rescuer'',''quartermaster'',''coroner'',''stair_scout'',''berserker'',''mutagen_doctor'',''soulcaster'',''ascetic_fighter'',''field_engineer'',''green_crown_martyr'',''unity_apostle'',''deep_rescue_officer'',''boss_tracker'',''return_guardian'',''green_crown_inquisitor'',''dragonblood_knight'',''sealed_archivist'',''corpse_tuner'',''self_alchemist'',''black_carriage_gambler'',''false_saint_proxy'',''hundred_battle_returnee''');
 IF patched=source THEN RAISE EXCEPTION 'JOB_SELECTION_PATCH_SOURCE_MISMATCH'; END IF;
 EXECUTE patched;
END $all_jobs$;
