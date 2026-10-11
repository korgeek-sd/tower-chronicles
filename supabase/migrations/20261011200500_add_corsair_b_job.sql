-- Corsair is a new B-rank job, preserving all existing 48 job records and odds.
insert into private.job_registration_catalog(job_id,rarity,enabled)
values ('corsair','B',true)
on conflict(job_id) do update set rarity=excluded.rarity,enabled=excluded.enabled;
