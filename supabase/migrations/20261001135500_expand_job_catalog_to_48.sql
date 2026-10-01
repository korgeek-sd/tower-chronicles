-- Expand the server-authoritative job registration catalog from 27 to the planned 48 jobs.
-- These jobs are catalog-only for now; combat skills/assets can be added independently later.
insert into private.job_registration_catalog(job_id,rarity,enabled) values
 ('green_crown_pilgrim','C',true),
 ('porter','C',true),
 ('guide','C',true),
 ('relic_collector','B',true),
 ('monster_dismantler','B',true),
 ('expedition_archivist','B',true),
 ('ascetic_priest','A',true),
 ('life_stitcher','A',true),
 ('subjugation_officer','A',true),
 ('rescuer','A',true),
 ('quartermaster','A',true),
 ('coroner','A',true),
 ('stair_scout','A',true),
 ('green_crown_martyr','SR',true),
 ('unity_apostle','SR',true),
 ('deep_rescue_officer','SR',true),
 ('boss_tracker','SR',true),
 ('return_guardian','SR',true),
 ('green_crown_inquisitor','SR',true),
 ('false_saint_proxy','SSR',true),
 ('hundred_battle_returnee','SSR',true)
on conflict(job_id) do update
set rarity=excluded.rarity,enabled=excluded.enabled;
