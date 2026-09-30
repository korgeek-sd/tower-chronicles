-- Add the B-rarity expansion job 등불지기 (lantern_keeper) to the server-authoritative registration pool.
insert into private.job_registration_catalog(job_id,rarity,enabled)
values ('lantern_keeper','B',true)
on conflict(job_id) do update
set rarity=excluded.rarity,enabled=excluded.enabled;
