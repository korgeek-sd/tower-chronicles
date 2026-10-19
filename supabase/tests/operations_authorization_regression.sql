-- All fixture writes are rolled back; execute as the database test owner.
begin;
set local lock_timeout='3s';
set local statement_timeout='25s';
create temporary table ops_auth_fixture as select label,gen_random_uuid() u,gen_random_uuid() request_id from unnest(array['user','admin']) label;
grant select on ops_auth_fixture to authenticated,anon;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data)
select u,case when label='admin' then '{"coupon_admin":true}'::jsonb else '{}'::jsonb end,'{"coupon_admin":true}'::jsonb from ops_auth_fixture;
insert into public.game_player_profiles(user_id,nickname) select u,'시험'||substr(replace(u::text,'-',''),1,8) from ops_auth_fixture;
create temporary table ops_auth_cases as
select p.proname,format('select public.%I(%s)',p.proname,coalesce((select string_agg('null::'||format_type(t,null),',' order by ord) from unnest(p.proargtypes::oid[]) with ordinality a(t,ord)),'')) call_sql,
case when p.proname like 'ops\_%' escape '\' then 'OPERATIONS_FORBIDDEN' when p.proname='get_system_monitoring' then 'MONITORING_FORBIDDEN' else 'COUPON_ADMIN_REQUIRED' end expected
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (p.proname like 'ops\_%' escape '\' or p.proname in ('create_game_coupon','set_game_coupon_enabled','list_game_coupons','get_system_monitoring'));
grant select on ops_auth_cases to authenticated,anon;
set local role authenticated;
do $test$
declare u uuid;c record;scenario integer;claims jsonb;
begin
 select f.u into u from ops_auth_fixture f where label='user';
 for scenario in 1..4 loop
  claims:=case scenario
   when 1 then jsonb_build_object('sub',u,'role','authenticated')
   when 2 then jsonb_build_object('sub',u,'role','authenticated','user_metadata',jsonb_build_object('coupon_admin',true))
   when 3 then jsonb_build_object('sub',u,'role','authenticated','app_metadata',jsonb_build_object('coupon_admin',true))
   else '{}'::jsonb end;
  perform set_config('request.jwt.claims',claims::text,true);
  if public.is_coupon_admin() then raise exception 'TEST_UNAUTHORIZED_ADMIN';end if;
  for c in select * from ops_auth_cases loop
   begin
    execute c.call_sql;
    raise exception 'TEST_UNAUTHORIZED_SUCCESS %',c.proname;
   exception when insufficient_privilege then
    if sqlerrm<>c.expected then raise;end if;
   end;
  end loop;
 end loop;
end $test$;
set local role anon;
do $test$
declare c record;
begin
 perform set_config('request.jwt.claims','{}',true);
 for c in select * from ops_auth_cases loop
  begin execute c.call_sql;raise exception 'TEST_ANON_SUCCESS %',c.proname;
  exception when insufficient_privilege then null;end;
 end loop;
end $test$;
set local role authenticated;
do $test$
declare a record;u uuid;r jsonb;r2 jsonb;c jsonb;
begin
 select * into a from ops_auth_fixture where label='admin';
 select f.u into u from ops_auth_fixture f where label='user';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated')::text,true);
 if not public.is_coupon_admin() then raise exception 'TEST_ADMIN_REJECTED';end if;
 r:=public.ops_grant_reward(u,'{"silver":1}'::jsonb,'보안 권한 회귀 시험',a.request_id);
 r2:=public.ops_grant_reward(u,'{"silver":1}'::jsonb,'보안 권한 회귀 시험',a.request_id);
 if r->>'mailId' is distinct from r2->>'mailId' or r2->>'duplicate' is distinct from 'true' then raise exception 'TEST_GRANT_REPLAY';end if;
 c:=public.ops_create_coupon('QA-'||substr(replace(a.u::text,'-',''),1,20),'보안 권한 시험','{"silver":1}'::jsonb,now()-interval '1 hour',now()+interval '1 hour',1);
 perform public.ops_set_coupon_enabled((c->>'couponId')::uuid,false);
 -- Coupon admin alone must not grant access to monitoring.
 begin perform public.get_system_monitoring();raise exception 'TEST_MONITOR_ADMIN_SCOPE';
 exception when insufficient_privilege then if sqlerrm<>'MONITORING_FORBIDDEN' then raise;end if;end;
end $test$;
reset role;
do $test$
declare a uuid;u uuid;
begin
 select f.u into a from ops_auth_fixture f where label='admin';
 select f.u into u from ops_auth_fixture f where label='user';
 if (select count(*) from private.operations_audit where actor_id=a and action='reward_grant')<>1 then raise exception 'TEST_AUDIT_REPLAY';end if;
 if (select count(*) from private.game_mail where user_id=u and title='운영팀 지급 보상')<>1 then raise exception 'TEST_MAIL_REPLAY';end if;
 if (select count(*) from private.operations_audit where actor_id=a and action in ('coupon_create','coupon_status'))<>2 then raise exception 'TEST_COUPON_AUDIT';end if;
 insert into private.monitoring_admins(user_id) values(a);
 update auth.users set raw_app_meta_data='{}'::jsonb where id=a;
end $test$;
set local role authenticated;
do $test$
declare a uuid;r jsonb;c record;
begin
 select f.u into a from ops_auth_fixture f where label='admin';
 -- Stale privileged JWT claim must not restore revoked DB permission.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','app_metadata',jsonb_build_object('coupon_admin',true))::text,true);
 if public.is_coupon_admin() then raise exception 'TEST_STALE_ADMIN_CLAIM';end if;
 for c in select * from ops_auth_cases where proname<>'get_system_monitoring' loop
  begin execute c.call_sql;raise exception 'TEST_REVOKED_ADMIN_SUCCESS %',c.proname;
  exception when insufficient_privilege then if sqlerrm<>c.expected then raise;end if;end;
 end loop;
 r:=public.get_system_monitoring();
 if r is null then raise exception 'TEST_MONITOR_ADMIN_REJECTED';end if;
end $test$;
reset role;
rollback;
select 'PASS: 20 endpoints x 5 unauthorized contexts; server metadata and revocation; scoped monitoring; authorized grants/coupons/audit and replay; fixture rolled back' as result;
