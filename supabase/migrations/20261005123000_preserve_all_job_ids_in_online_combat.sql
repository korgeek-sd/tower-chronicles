-- Preserve every selectable Tower Chronicles job as the immutable expedition
-- combat snapshot. Job identity/visuals must not disappear merely because a
-- job-specific server skill handler is not implemented yet.
create or replace function private.server_job_id(p_payload jsonb)
returns text
language sql
immutable
set search_path=''
as $$
  select case
    when p_payload->'expedition'->>'jobSnapshotId' = any(array[
      'contract_mercenary','hunter','excavator','field_medic','reclaimer','green_crown_pilgrim','porter','guide',
      'vanguard_explorer','tracker','survivor','duelist','expedition_medic','redeemer','lantern_keeper','relic_collector','monster_dismantler','expedition_archivist',
      'executor','inquisitor','deep_delver','bloodfighter','expedition_tactician','ascetic_priest','life_stitcher','subjugation_officer','rescuer','quartermaster','coroner','stair_scout',
      'berserker','mutagen_doctor','soulcaster','ascetic_fighter','field_engineer','green_crown_martyr','unity_apostle','deep_rescue_officer','boss_tracker','return_guardian','green_crown_inquisitor',
      'dragonblood_knight','sealed_archivist','corpse_tuner','self_alchemist','black_carriage_gambler','false_saint_proxy','hundred_battle_returnee'
    ]::text[])
    then p_payload->'expedition'->>'jobSnapshotId'
    else null
  end
$$;

revoke all on function private.server_job_id(jsonb) from public,anon,authenticated;
