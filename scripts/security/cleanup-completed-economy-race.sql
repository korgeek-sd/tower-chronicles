-- Only disposable fixtures from the explicitly approved 2026-10-20 concurrency test.
-- Run through a working privileged database connection; contains no credentials.
begin;
drop function if exists public.tc_race_2457f70d_driver(text,integer,integer,boolean,boolean);
drop schema if exists tc_race_2457f70d_auth,tc_race_2457f70d_private,tc_race_2457f70d_public,tc_race_2457f70d_realtime cascade;
delete from auth.sessions where user_id='2457f70d-f834-47cc-bec4-b3f9b9243453'::uuid;
delete from auth.users where id='2457f70d-f834-47cc-bec4-b3f9b9243453'::uuid and email='race-qa-2457f70d@example.invalid';
commit;
select
 (select count(*) from pg_namespace where nspname in('tc_race_2457f70d_auth','tc_race_2457f70d_private','tc_race_2457f70d_public','tc_race_2457f70d_realtime')) as fixture_schemas,
 (select count(*) from auth.users where id='2457f70d-f834-47cc-bec4-b3f9b9243453'::uuid) as fixture_users,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tc_race_2457f70d_driver') as public_drivers;
