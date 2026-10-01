-- Synthetic users only, fully rolled back. Run against migrated database.
begin;
create temporary table mail_fixture as select gen_random_uuid() u,gen_random_uuid() s,gen_random_uuid() l from generate_series(1,2);
grant select on mail_fixture to authenticated;
insert into auth.users(id) select u from mail_fixture;
insert into auth.sessions(id,user_id,created_at,updated_at) select s,u,now(),now() from mail_fixture;
insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
select u,l,s,'mail-qa','mail-qa','QA','0.1.92',1,now(),now(),now()+interval '1 hour' from mail_fixture;
insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
select u,1,23,'0.1.92',private.server_bootstrap_payload('{}')||jsonb_build_object('version',23,'equipmentItems','[]'::jsonb,'silver',100000,'lootItems',jsonb_build_object('enhancement_stone',10)),'qa' from mail_fixture;
select private.sync_market_economy_from_latest_save(u) from mail_fixture;
create temporary table edge_ids(buy_id uuid, sell_id uuid, mail_id uuid);
grant all on edge_ids to authenticated;
set local role authenticated;
do $$
declare a record;b record;r jsonb; oid uuid;
begin
select * into a from mail_fixture order by u limit 1;select * into b from mail_fixture where u<>a.u;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
r:=public.place_online_market_order(a.l,1,'mail-qa','mail-qa','other:enhancement_stone','BUY',1000,10);
select (x->>'orderId')::uuid into oid from jsonb_array_elements(r->'orders') x where (x->>'mine')::boolean;
insert into edge_ids(buy_id) values(oid);
r:=public.cancel_online_market_order(a.l,1,'mail-qa','mail-qa',oid);
if (r->'wallet'->>'silver')::bigint<>100000 then raise exception 'Buy cancellation did not refund reserve';end if;
r:=public.get_game_mail();
if r->'mails'->0->>'title'<>'구매 주문 취소' or (r->'mails'->0->'details'->>'refund')::bigint<>10000 then raise exception 'Buy cancel summary mismatch';end if;
begin perform public.manage_game_mail(gen_random_uuid(),1,'mail-qa','mail-qa','claim_all',null);raise exception 'Lost lease accepted';exception when others then if sqlerrm not like '%GAME_SESSION_LOST%' then raise;end if;end;
r:=public.place_online_market_order(a.l,1,'mail-qa','mail-qa','other:enhancement_stone','SELL',1000,10);
select (x->>'orderId')::uuid into oid from jsonb_array_elements(r->'orders') x where (x->>'mine')::boolean;
update edge_ids set sell_id=oid;
r:=public.cancel_online_market_order(a.l,1,'mail-qa','mail-qa',oid);
r:=public.get_game_mail();
select (x->>'mailId')::uuid into oid from jsonb_array_elements(r->'mails') x where x->>'title'='판매 주문 취소';update edge_ids set mail_id=oid;
end $$;
reset role;
-- A pending attachment cannot be claimed during an expedition.
update public.game_saves set payload=jsonb_set(payload,'{expedition}','{}') where user_id=(select u from mail_fixture order by u limit 1);
set local role authenticated;
do $$declare a record;begin
select * into a from mail_fixture order by u limit 1;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
begin perform public.manage_game_mail(a.l,1,'mail-qa','mail-qa','claim_all',null);raise exception 'Expedition claim allowed';exception when others then if sqlerrm not like '%MAIL_EXPEDITION_BLOCKED%' then raise;end if;end;
end $$;
reset role;
update public.game_saves set payload=jsonb_set(payload,'{expedition}','null') where user_id in(select u from mail_fixture);
-- Expired attachments are destroyed even if they were never read or claimed.
update private.game_mail set expires_at=now()-interval '1 second' where mail_id=(select mail_id from edge_ids);
select private.maintain_game_mail();
do $$begin
if exists(select 1 from private.game_mail where mail_id=(select mail_id from edge_ids)) then raise exception 'Unclaimed expired attachment retained';end if;
if exists(select 1 from private.market_assets where user_id=(select u from mail_fixture order by u limit 1) and item_id='other:enhancement_stone') then raise exception 'Expired attachment returned to inventory';end if;
end $$;
set local role authenticated;
do $$declare a record;r jsonb;oid uuid;begin
select * into a from mail_fixture order by u limit 1;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
r:=public.place_online_market_order(a.l,1,'mail-qa','mail-qa','other:enhancement_stone','BUY',1000,10);
select (x->>'orderId')::uuid into oid from jsonb_array_elements(r->'orders') x where (x->>'mine')::boolean;
update edge_ids set buy_id=oid;
end $$;
reset role;
update private.market_orders set expires_at=now()-interval '1 second' where order_id=(select buy_id from edge_ids);
set local role authenticated;
do $$declare b record;r jsonb;begin
select * into b from mail_fixture order by u desc limit 1;
perform set_config('request.jwt.claims',jsonb_build_object('sub',b.u,'role','authenticated','session_id',b.s)::text,true);
r:=public.place_online_market_order(b.l,1,'mail-qa','mail-qa','other:enhancement_stone','SELL',1000,5);
if (r->'wallet'->>'silver')::bigint<>100000 then raise exception 'Expired order matched before cron';end if;
end $$;
reset role;
select private.maintain_game_mail();
do $$begin
if (select silver from private.player_wallets where user_id=(select u from mail_fixture order by u limit 1))<>100000 then raise exception 'Buy expiry reserve refund mismatch';end if;
if not exists(select 1 from private.game_mail where user_id=(select u from mail_fixture order by u limit 1) and title='구매 주문 만료') then raise exception 'Buy expiry mail absent';end if;
end $$;
rollback;
