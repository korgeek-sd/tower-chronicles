-- Real RPC tests with new synthetic accounts; the entire fixture is rolled back.
begin;
create temporary table growth_fixture as select gen_random_uuid() u,gen_random_uuid() a,gen_random_uuid() s,gen_random_uuid() l;
grant select on growth_fixture to authenticated;
insert into auth.users(id) select u from growth_fixture;
insert into auth.sessions(id,user_id,created_at,updated_at) select s,u,now(),now() from growth_fixture;
insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
 select u,l,s,'growth-qa','growth-qa','QA','0.1.92',1,now(),now(),now()+interval '1 hour' from growth_fixture;
insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
 select u,1,23,'0.1.92',private.server_bootstrap_payload('{}')||jsonb_build_object('version',23,'equipmentItems','[]'::jsonb),'qa' from growth_fixture;
insert into private.player_wallets(user_id,silver,gold,last_synced_revision) select u,1000000,10000,1 from growth_fixture
 on conflict(user_id) do update set silver=1000000,gold=10000,last_synced_revision=1;
insert into private.online_associations(association_id,record_number,name,leader_user_id)
 select a,'QA-'||a,'QA'||substr(a::text,1,12),u from growth_fixture;
insert into private.online_association_members(association_id,user_id,role) select a,u,'LEADER' from growth_fixture;

set local role authenticated;
do $$
declare f record; r jsonb; req uuid:=gen_random_uuid(); before_gold bigint;
begin
 select * into f from growth_fixture;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 r:=public.donate_to_association(f.l,1,'growth-qa','growth-qa',req,'silver',10000);
 if (r->'record'->'payload'->>'silver')::bigint<>990000 or (r->'progression'->>'contributionPoint')::bigint<>100 then raise exception 'Silver donation not atomic';end if;
 r:=public.donate_to_association(f.l,1,'growth-qa','growth-qa',req,'silver',10000);
 if (r->'record'->'payload'->>'silver')::bigint<>990000 or not (r->>'replayed')::boolean then raise exception 'Duplicate donation charged';end if;
 begin perform public.donate_to_association(f.l,1,'growth-qa','growth-qa',req,'gold',100);raise exception 'Request conflict accepted';
 exception when others then if sqlerrm not like '%ASSOCIATION_REQUEST_CONFLICT%' then raise;end if;end;
 r:=public.donate_to_association(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'gold',100);
 if (r->'progression'->>'associationExp')::bigint<>300 or (r->'progression'->>'contributionPoint')::bigint<>300 or (r->'record'->'payload'->'market'->>'gold')::bigint<>9900 then raise exception 'Gold exchange mismatch';end if;
 perform public.donate_to_association(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'silver',40000);
 begin perform public.donate_to_association(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'silver',10000);raise exception 'Donation limit accepted';
 exception when others then if sqlerrm not like '%ASSOCIATION_DONATION_LIMIT%' then raise;end if;end;
 begin perform public.donate_to_association(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'silver',1);raise exception 'Partial unit accepted';
 exception when others then if sqlerrm not like '%ASSOCIATION_DONATION_INVALID%' then raise;end if;end;
 begin perform public.get_online_association_shop(gen_random_uuid(),1,'growth-qa','growth-qa');raise exception 'Bad lease accepted';
 exception when others then if sqlerrm not like '%GAME_SESSION_LOST%' then raise;end if;end;
 begin perform public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'job_draw_ticket_daily');raise exception 'Locked level accepted';
 exception when others then if sqlerrm not like '%ASSOCIATION_LEVEL_REQUIRED%' then raise;end if;end;
end $$;
reset role;
update private.online_associations set association_level=5,association_exp=30000 where association_id=(select a from growth_fixture);
update private.online_association_member_progression set contribution_point=100000 where user_id=(select u from growth_fixture);
set local role authenticated;
do $$
declare f record; r jsonb; req uuid:=gen_random_uuid(); drawreq uuid:=gen_random_uuid(); initial_gold bigint; records_before bigint; records_after bigint; i integer;
begin
 select * into f from growth_fixture;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 r:=public.get_online_association_shop(f.l,1,'growth-qa','growth-qa');
 if jsonb_array_length(r->'daily')<>4 or jsonb_array_length(r->'weekly')<>5 then raise exception 'Product table mismatch';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',req,'job_draw_ticket_daily');
 if (r->'state'->>'contribution')::bigint<>99000 or (r->'record'->'payload'->'lootItems'->>'job_draw_ticket')::bigint<>5 then raise exception 'Ticket purchase mismatch';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',req,'job_draw_ticket_daily');
 if (r->'state'->>'contribution')::bigint<>99000 or not (r->>'replayed')::boolean then raise exception 'Purchase replay charged';end if;
 begin perform public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'job_draw_ticket_daily');raise exception 'Daily limit bypassed';
 exception when others then if sqlerrm not like '%ASSOCIATION_PURCHASE_LIMIT%' then raise;end if;end;
 initial_gold:=(r->'record'->'payload'->'market'->>'gold')::bigint;
 r:=public.register_online_job_with_tickets(f.l,1,'growth-qa','growth-qa',drawreq,1);
 if jsonb_array_length(r->'results')<>1 or (r->'record'->'payload'->'lootItems'->>'job_draw_ticket')::bigint<>4 or (r->>'goldAfter')::bigint<>initial_gold then raise exception 'Ticket draw mismatch';end if;
 select sum((x->>'recordCount')::bigint) into records_before from jsonb_array_elements(r->'state'->'records') x;
 r:=public.register_online_job_with_tickets(f.l,1,'growth-qa','growth-qa',drawreq,1);
 select sum((x->>'recordCount')::bigint) into records_after from jsonb_array_elements(r->'state'->'records') x;
 if not (r->>'replayed')::boolean or records_before<>records_after or (r->'record'->'payload'->'lootItems'->>'job_draw_ticket')::bigint<>4 then raise exception 'Draw replay changed inventory';end if;
 begin perform public.register_online_job_with_tickets(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),10);raise exception 'Ticket shortage bypassed';
 exception when others then if sqlerrm not like '%ASSOCIATION_TICKET_SHORTAGE%' then raise;end if;end;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'job_draw_ticket_weekly');
 if (r->'record'->'payload'->'lootItems'->>'job_draw_ticket')::bigint<>34 then raise exception 'Weekly tickets not credited';end if;
 r:=public.register_online_job_with_tickets(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),10);
 if jsonb_array_length(r->'results')<>10 or (r->'record'->'payload'->'lootItems'->>'job_draw_ticket')::bigint<>24 then raise exception 'Ten tickets must yield exactly ten records';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'enhancement_stone_weekly');
 if (r->'record'->'payload'->'lootItems'->>'enhancement_stone')::bigint<>100 then raise exception 'Stone bundle mismatch';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'enhancement_stone_daily');
 if (r->'record'->'payload'->'lootItems'->>'enhancement_stone')::bigint<>101 then raise exception 'Daily stone mismatch';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'greater_potion_weekly');
 if (r->'record'->'payload'->'potions'->>'healing_greater')::bigint<>10 then raise exception 'Potion bundle mismatch';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'greater_potion_daily');
 if (r->'record'->'payload'->'potions'->>'healing_greater')::bigint<>11 then raise exception 'Daily potion mismatch';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'silver_box_daily');
 if (r->'record'->'payload'->>'silver')::bigint<>960000 then raise exception 'Silver box mismatch';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'gold_box_weekly');
 if (r->'record'->'payload'->'market'->>'gold')::bigint<>initial_gold+100 then raise exception 'Gold box mismatch';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'rare_equipment_weekly');
 if r->'reward'->'equipment'->>'grade'<>'rare' or (r->'reward'->'equipment'->>'enhancement')::integer<>0 or jsonb_array_length(r->'record'->'payload'->'equipmentItems')<>1 then raise exception 'Equipment box mismatch';end if;
end $$;
reset role;
-- Older purchase periods become available again without deleting historical records.
update private.online_association_shop_purchases set purchased_at=now()-interval '8 days' where user_id=(select u from growth_fixture);
update private.online_association_donations set created_at=now()-interval '2 days' where user_id=(select u from growth_fixture);
set local role authenticated;
do $$declare f record; r jsonb;begin
 select * into f from growth_fixture;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 r:=public.get_online_association_shop(f.l,1,'growth-qa','growth-qa');
 if exists(select 1 from jsonb_array_elements((r->'daily')||(r->'weekly')) x where (x->>'purchased')::int<>0) then raise exception 'Period reset failed';end if;
 r:=public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'job_draw_ticket_daily');
 if (r->'record'->'payload'->'lootItems'->>'job_draw_ticket')::bigint<>29 then raise exception 'Reset purchase failed';end if;
 perform public.donate_to_association(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'silver',50000);
end $$;
reset role;
-- Membership changes cannot reset account-wide limits.
delete from private.online_association_members where user_id=(select u from growth_fixture);
insert into private.online_associations(association_id,record_number,name,leader_user_id,association_level,association_exp)
 select gen_random_uuid(),'QA-SECOND-'||a,'QB'||substr(a::text,1,12),u,5,30000 from growth_fixture;
insert into private.online_association_members(association_id,user_id,role)
 select a.association_id,f.u,'LEADER' from private.online_associations a,growth_fixture f where a.record_number='QA-SECOND-'||f.a;
insert into private.online_association_member_progression(association_id,user_id,contribution_point)
 select association_id,user_id,10000 from private.online_association_members where user_id=(select u from growth_fixture);
set local role authenticated;
do $$declare f record;begin
 select * into f from growth_fixture;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 begin perform public.donate_to_association(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'silver',10000);raise exception 'Guild hopping reset donation limit';
 exception when others then if sqlerrm not like '%ASSOCIATION_DONATION_LIMIT%' then raise;end if;end;
 begin perform public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'job_draw_ticket_daily');raise exception 'Guild hopping reset purchase limit';
 exception when others then if sqlerrm not like '%ASSOCIATION_PURCHASE_LIMIT%' then raise;end if;end;
end $$;
reset role;
update private.online_association_member_progression set contribution_point=0 where user_id=(select u from growth_fixture);
set local role authenticated;
do $$declare f record;begin
 select * into f from growth_fixture;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 begin perform public.buy_online_association_shop_item(f.l,1,'growth-qa','growth-qa',gen_random_uuid(),'enhancement_stone_daily');raise exception 'Insufficient contribution accepted';
 exception when others then if sqlerrm not like '%ASSOCIATION_CONTRIBUTION_SHORTAGE%' then raise;end if;end;
end $$;
reset role;
delete from private.online_association_members where user_id=(select u from growth_fixture);
set local role authenticated;
do $$declare f record;begin
 select * into f from growth_fixture;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated','session_id',f.s)::text,true);
 begin perform public.get_online_association_shop(f.l,1,'growth-qa','growth-qa');raise exception 'Former member retained shop access';
 exception when others then if sqlerrm not like '%ASSOCIATION_NOT_JOINED%' then raise;end if;end;
end $$;
reset role;
do $$begin
 if private.association_period_start('WEEKLY','2026-10-04 15:00Z')<>'2026-10-04 15:00Z'::timestamptz then raise exception 'Weekly KST boundary';end if;
 if private.association_period_start('DAILY','2026-10-01 14:59:59Z')<>'2026-09-30 15:00Z'::timestamptz then raise exception 'Daily KST boundary';end if;
 if has_function_privilege('anon','public.donate_to_association(uuid,bigint,text,text,uuid,text,bigint)','execute') then raise exception 'Anonymous donation access';end if;
 if has_table_privilege('authenticated','private.online_association_member_progression','update') then raise exception 'Direct point mutation allowed';end if;
end $$;
rollback;
select 'PASS: atomic donations, all nine products, idempotency, ticket draws, limits, KST reset, guild hopping, membership and permissions; synthetic fixtures rolled back' result;
