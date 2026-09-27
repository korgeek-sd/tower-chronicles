create index if not exists player_job_records_job_id_idx on private.player_job_records(job_id);
create index if not exists player_job_pickups_sr_job_id_idx on private.player_job_pickups(sr_job_id) where sr_job_id is not null;
create index if not exists player_job_pickups_ssr_job_id_idx on private.player_job_pickups(ssr_job_id) where ssr_job_id is not null;
