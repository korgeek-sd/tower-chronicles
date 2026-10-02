-- Synthetic accounts and rewards. Every write is rolled back.
begin;
create temporary table coupon_fixture as select label,gen_random_uuid() u,gen_random_uuid() s,gen_random_uuid() l from unnest(array['admin','a','b']) label;
grant select on coupon_fixture to authenticated;
insert into auth.users(id,raw_app_meta_data) select u,case when label='admin' then '{"coupon_admin":true}'::jsonb else '{}'::jsonb end from coupon_fixture;
insert into auth.sessions(id,user_id,created_at,updated_at) select s,u,now(),now() from coupon_fixture;
insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
select u,l,s,'coupon-qa','coupon-qa','QA','0.1.92',1,now(),now(),now()+interval '1 hour' from coupon_fixture;
insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
select u,1,23,'0.1.92',private.server_bootstrap_payload('{}')||jsonb_build_object('version',23,'equipmentItems','[]'::jsonb,'silver',1000,'lootItems','{}'::jsonb),'qa' from coupon_fixture;
select private.sync_market_economy_from_latest_save(u) from coupon_fixture;
create temporary table coupon_results(label text,result jsonb);
grant all on coupon_results to authenticated;
create function pg_temp.expect_coupon_error(q text,expected text) returns void language plpgsql as $$
begin
 begin execute q;exception when others then if position(expected in sqlerrm)>0 then return;else raise;end if;end;
 raise exception 'Expected error % for %',expected,q;
end $$;
set local role authenticated;
do $$declare f record;r jsonb;
begin
 select * into f from coupon_fixture where label='a';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s,'user_metadata',jsonb_build_object('coupon_admin',true))::text,true);
 if public.is_coupon_admin() then raise exception 'User-editable metadata granted admin';end if;
 perform pg_temp.expect_coupon_error('select public.list_game_coupons()','COUPON_ADMIN_REQUIRED');
 perform pg_temp.expect_coupon_error($q$select public.create_game_coupon('QA-UNAUTH','test','{"silver":10}',now(),now()+interval '1 day',null)$q$,'COUPON_ADMIN_REQUIRED');
 perform set_config('request.jwt.claims','{}',true);
 perform pg_temp.expect_coupon_error($q$select public.redeem_game_coupon('QA-TEST')$q$,'AUTH_REQUIRED');
 select * into f from coupon_fixture where label='admin';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 if not public.is_coupon_admin() then raise exception 'Admin detection failed';end if;
 r:=public.create_game_coupon('qa-bundle','test','{"silver":200,"gold":3,"items":[{"id":"other:enhancement_stone","quantity":4},{"id":"other:job_draw_ticket","quantity":2}]}',now()-interval '1 hour',now()+interval '1 day',null);
 insert into coupon_results values('created',r);
 perform public.create_game_coupon('QA-LIMIT','limited','{"silver":1}',now()-interval '1 hour',now()+interval '1 day',1);
 perform public.create_game_coupon('QA-FUTURE','future','{"silver":1}',now()+interval '1 hour',now()+interval '1 day',null);
 perform public.create_game_coupon('QA-EXPIRED','expired','{"silver":1}',now()-interval '2 days',now()-interval '1 day',null);
 perform public.create_game_coupon('QA-DISABLED','disabled','{"silver":1}',now()-interval '1 hour',now()+interval '1 day',null);
 perform public.set_game_coupon_enabled((select (x->>'couponId')::uuid from jsonb_array_elements(public.list_game_coupons())x where x->>'code'='QA-DISABLED'),false);
 perform pg_temp.expect_coupon_error($q$select public.create_game_coupon('QA-BUNDLE','duplicate','{"silver":1}',now(),now()+interval '1 day',null)$q$,'COUPON_DUPLICATE');
 perform pg_temp.expect_coupon_error($q$select public.create_game_coupon('QA-BAD','bad','{"silver":-1}',now(),now()+interval '1 day',null)$q$,'COUPON_REWARD_INVALID');
 perform pg_temp.expect_coupon_error($q$select public.create_game_coupon('QA-BAD','bad','{"items":[{"id":"equipment_v2:fake","quantity":1}]}',now(),now()+interval '1 day',null)$q$,'COUPON_REWARD_INVALID');
 perform pg_temp.expect_coupon_error($q$select public.create_game_coupon('QA-BAD','bad','{"silver":0}',now(),now()+interval '1 day',null)$q$,'COUPON_REWARD_INVALID');
 select * into f from coupon_fixture where label='a';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 perform pg_temp.expect_coupon_error($q$select public.redeem_game_coupon('QA-MISSING')$q$,'COUPON_INVALID');
 perform pg_temp.expect_coupon_error($q$select public.redeem_game_coupon('QA-FUTURE')$q$,'COUPON_NOT_STARTED');
 perform pg_temp.expect_coupon_error($q$select public.redeem_game_coupon('QA-EXPIRED')$q$,'COUPON_EXPIRED');
 perform pg_temp.expect_coupon_error($q$select public.redeem_game_coupon('QA-DISABLED')$q$,'COUPON_INVALID');
 r:=public.redeem_game_coupon('  qa-bundle  ');insert into coupon_results values('redeemed',r);
 perform pg_temp.expect_coupon_error($q$select public.redeem_game_coupon('QA-BUNDLE')$q$,'COUPON_ALREADY_USED');
 perform public.redeem_game_coupon('QA-LIMIT');
 select * into f from coupon_fixture where label='b';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 perform pg_temp.expect_coupon_error($q$select public.redeem_game_coupon('QA-LIMIT')$q$,'COUPON_EXHAUSTED');
 -- Another account can redeem the unlimited coupon, but cannot claim a's mail.
 perform public.redeem_game_coupon('QA-BUNDLE');
 perform pg_temp.expect_coupon_error(format('select public.manage_game_mail(%L,1,%L,%L,%L,%L)',f.l,'coupon-qa','coupon-qa','claim',(select result->>'mailId' from coupon_results where label='redeemed')),'MAIL_NOT_FOUND');
end $$;
reset role;
do $$begin
 if (select used_count from private.game_coupons where code='QA-BUNDLE')<>2 then raise exception 'Count incorrect';end if;
 if (select count(*) from private.coupon_claims where coupon_id=(select coupon_id from private.game_coupons where code='QA-BUNDLE'))<>2 then raise exception 'Duplicate claim';end if;
 if (select silver from private.player_wallets where user_id=(select u from coupon_fixture where label='a'))<>1000 then raise exception 'Coupon bypassed mail';end if;
 if exists(select 1 from private.market_assets where user_id=(select u from coupon_fixture where label='a') and quantity>0) then raise exception 'Items bypassed mail';end if;
end $$;
set local role authenticated;
do $$declare f record;r jsonb;m uuid;
begin
 select * into f from coupon_fixture where label='a';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 m:=(select result->>'mailId' from coupon_results where label='redeemed')::uuid;
 r:=public.get_game_mail();
 if not exists(select 1 from jsonb_array_elements(r->'mails')x where (x->>'mailId')::uuid=m and x->'attachment'->'reward'->>'silver'='200') then raise exception 'Reward not visible';end if;
 perform pg_temp.expect_coupon_error(format('select public.manage_game_mail(%L,1,%L,%L,%L,%L)',f.l,'coupon-qa','coupon-qa','delete',m),'MAIL_UNCLAIMED');
 perform public.manage_game_mail(f.l,1,'coupon-qa','coupon-qa','claim',m);
 r:=public.manage_game_mail(f.l,1,'coupon-qa','coupon-qa','claim',m);
 if (r->'economy'->'wallet'->>'silver')::bigint<>1200 then raise exception 'Silver replay or missing reward';end if;
 if (r->'economy'->'wallet'->>'gold')::bigint<>3 then raise exception 'Gold replay or missing reward';end if;
 if (select (x->>'quantity')::bigint from jsonb_array_elements(r->'economy'->'assets')x where x->>'itemId'='other:enhancement_stone')<>4 then raise exception 'Item replay or missing reward';end if;
 perform public.manage_game_mail(f.l,1,'coupon-qa','coupon-qa','delete',m);
 perform pg_temp.expect_coupon_error($q$select public.redeem_game_coupon('QA-BUNDLE')$q$,'COUPON_ALREADY_USED');
end $$;
reset role;
do $$begin
 if (select (payload->>'silver')::bigint from public.game_saves where user_id=(select u from coupon_fixture where label='a'))<>1200 then raise exception 'Reward not persisted';end if;
 if (select (payload->'lootItems'->>'job_draw_ticket')::bigint from public.game_saves where user_id=(select u from coupon_fixture where label='a'))<>2 then raise exception 'Ticket not persisted';end if;
 if has_table_privilege('authenticated','private.game_coupons','INSERT') or has_function_privilege('anon','public.redeem_game_coupon(text)','EXECUTE') then raise exception 'Public access leak';end if;
end $$;
rollback;

