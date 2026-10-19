-- Synthetic fixture only. Roll back every test write.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
create temporary table save_security_fixture as
select gen_random_uuid() u,gen_random_uuid() s,gen_random_uuid() l;
grant select on save_security_fixture to authenticated;
insert into auth.users(id,raw_app_meta_data) select u,'{}'::jsonb from save_security_fixture;
insert into auth.sessions(id,user_id,created_at,updated_at) select s,u,now(),now() from save_security_fixture;
insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
select u,l,s,'save-security-qa','save-security-qa','QA','security-test',1,now(),now(),now()+interval '1 hour' from save_security_fixture;
set local role authenticated;
do $test$
declare f record;r record;p jsonb;
begin
 select * into f from save_security_fixture;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 p:='{"version":23,"silver":999999,"equipmentItems":[{"id":"forged-qa","kind":"association_supply_iron_sword","grade":"legendary","enhancement":999}],"equipmentLoadout":{"weapon":"forged-qa"},"materials":{},"tickets":{},"market":{"gold":999999}}'::jsonb;
 -- NULL initial revision must fail without creating any save.
 begin
  perform public.save_game_state(f.l,1,'save-security-qa',null,23,'security-test',p,'unused','save-security-qa');
  raise exception 'TEST_NULL_INITIAL_ACCEPTED';
 exception when others then if sqlerrm<>'SAVE_CONFLICT' then raise;end if;end;
 if exists(select 1 from public.game_saves where user_id=f.u) then raise exception 'TEST_FAILED_INITIAL_WROTE_SAVE';end if;
 select * into r from public.save_game_state(f.l,1,'save-security-qa',0,23,'security-test',p,'unused','save-security-qa');
 if r.revision is distinct from 1::bigint then raise exception 'TEST_INITIAL_REVISION';end if;
 -- NULL, negative, stale, and future revisions must all fail.
 for r in select v from (values (null::bigint),(-1::bigint),(0::bigint),(2::bigint)) q(v) loop
  begin
   perform public.save_game_state(f.l,1,'save-security-qa',r.v,23,'security-test',p,'unused','save-security-qa');
   raise exception 'TEST_BAD_REVISION_ACCEPTED';
  exception when others then if sqlerrm<>'SAVE_CONFLICT' then raise;end if;end;
 end loop;
 if (select revision from public.game_saves where user_id=f.u) is distinct from 1::bigint then raise exception 'TEST_FAILED_SAVE_CHANGED_REVISION';end if;
 select * into r from public.save_game_state(f.l,1,'save-security-qa',1,23,'security-test',p,'unused','save-security-qa');
 if r.revision is distinct from 2::bigint then raise exception 'TEST_NORMAL_UPDATE_FAILED';end if;
end $test$;
reset role;
do $test$
declare u uuid;p jsonb;
begin
 select f.u into u from save_security_fixture f;
 select payload into p from public.game_saves where user_id=u;
 if exists(select 1 from private.market_assets a where a.user_id=u and a.item_id='equipment_v2:forged-qa') then raise exception 'TEST_FORGED_ASSET_IMPORTED';end if;
 if not exists(select 1 from private.market_assets a where a.user_id=u and a.item_id='equipment_v2:starter-v2' and a.quantity=1 and a.gear->>'grade'='common' and a.gear->>'enhancement'='0') then raise exception 'TEST_CANONICAL_STARTER_MISSING';end if;
 if p->'equipmentItems' is distinct from '[{"id":"starter-v2","kind":"association_supply_iron_sword","grade":"common","enhancement":0}]'::jsonb then raise exception 'TEST_EQUIPMENT_OVERWRITE';end if;
 if p->>'silver' is distinct from '0' or p->'market'->>'gold' is distinct from '1000' then raise exception 'TEST_CURRENCY_OVERWRITE';end if;
 if not exists(select 1 from public.game_save_versions v where v.user_id=u and v.revision=1) then raise exception 'TEST_HISTORY_MISSING';end if;
 if not has_function_privilege('authenticated','public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text)','EXECUTE') or has_function_privilege('anon','public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text)','EXECUTE') then raise exception 'TEST_RPC_GRANTS_CHANGED';end if;
end $test$;
rollback;
select 'PASS: bootstrap forgery blocked; NULL/negative/stale/future revisions rejected; normal saves, server currencies, history and grants preserved; fixture rolled back' as result;
