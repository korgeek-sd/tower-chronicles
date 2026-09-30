-- Add the B-rarity expansion job 대속자 (redeemer) to the server-authoritative registration pool.
insert into private.job_registration_catalog(job_id,rarity,enabled)
values ('redeemer','B',true)
on conflict(job_id) do update
set rarity=excluded.rarity,enabled=excluded.enabled;
