-- Synthetic users only, fully rolled back. Run against migrated database.
begin;
create temporary table mail_fixture as select gen_random_uuid() u,gen_random_uuid() s,gen_random_uuid() l from generate_series(1,2);
grant select on mail_fixture to authenticated;
insert into auth.users(id) select u from mail_fixture;
insert into auth.sessions(id,user_id,created_at,updated_at) select s,u,now(),now() from mail_fixture;
insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
select u,l,s,'mail-qa','mail-qa','QA','0.1.92',1,now(),now(),now()+interval '1 hour' from mail_fixture;
insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
select u,1,23,'0.1.92',private.server_bootstrap_payload('{}')||jsonb_build_object('version',23,'equipmentItems',(select jsonb_agg(jsonb_build_object('id',u::text||'-mail-gear-'||x,'kind','association_supply_iron_sword','grade','rare','enhancement',2)) from generate_series(1,10) x),'silver',100000),'qa' from mail_fixture;
select private.sync_market_economy_from_latest_save(u) from mail_fixture;
create temporary table mail_orders(sell_id uuid,buy_id uuid,seller uuid,buyer uuid);
grant all on mail_orders to authenticated;
set local role authenticated;
do $$
declare a record;b record;r jsonb; sid uuid;
begin
select * into a from mail_fixture order by u limit 1;select * into b from mail_fixture where u<>a.u;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
r:=public.place_online_market_order(a.l,1,'mail-qa','mail-qa','equipment_v2:'||a.u::text||'-mail-gear-1','SELL',1000,10);
select (x->>'orderId')::uuid into sid from jsonb_array_elements(r->'orders') x where (x->>'mine')::boolean and x->>'side'='SELL';
perform set_config('request.jwt.claims',jsonb_build_object('sub',b.u,'role','authenticated','session_id',b.s)::text,true);
r:=public.place_online_market_order(b.l,1,'mail-qa','mail-qa','equipment:association_supply_iron_sword:rare:+2','BUY',1000,5);
if (r->'wallet'->>'silver')::bigint<>95000 then raise exception 'Buyer debit mismatch';end if;
insert into mail_orders values(sid,null,a.u,b.u);
end $$;
reset role;
do $$begin
if (select silver from private.player_wallets where user_id=(select seller from mail_orders))<>105000 then raise exception 'Partial sale proceeds not immediate';end if;
if (select count(*) from private.market_assets where user_id=(select buyer from mail_orders) and item_id like 'equipment_v2:%-mail-gear-%')<>15 then raise exception 'Buyer delivery not immediate';end if;
if exists(select 1 from private.game_mail where user_id=(select seller from mail_orders)) then raise exception 'Partial fill created premature summary';end if;
end $$;
update private.market_orders set expires_at=now()-interval '1 second' where order_id=(select sell_id from mail_orders);
select private.maintain_game_mail();
select private.maintain_game_mail();
do $$begin
if (select count(*) from private.game_mail where user_id=(select seller from mail_orders))<>1 then raise exception 'Expiry duplicated mail';end if;
if (select attachment_quantity from private.game_mail where user_id=(select seller from mail_orders))<>5 then raise exception 'Expiry must attach only five';end if;
if exists(select 1 from private.market_assets where user_id=(select seller from mail_orders) and item_id like 'equipment_v2:%-mail-gear-%' and quantity>0) then raise exception 'Return bypassed mail';end if;
end $$;
set local role authenticated;
do $$
declare a record;b record;r jsonb;m uuid;
begin
select * into a from mail_fixture where u=(select seller from mail_orders);select * into b from mail_fixture where u<>a.u;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
r:=public.get_game_mail();m:=(r->'mails'->0->>'mailId')::uuid;
begin perform public.manage_game_mail(a.l,1,'mail-qa','mail-qa','delete',m);raise exception 'Unclaimed mail deleted';exception when others then if sqlerrm not like '%MAIL_UNCLAIMED%' then raise;end if;end;
perform set_config('request.jwt.claims',jsonb_build_object('sub',b.u,'role','authenticated','session_id',b.s)::text,true);
begin perform public.manage_game_mail(b.l,1,'mail-qa','mail-qa','claim',m);raise exception 'Foreign mail claimed';exception when others then if sqlerrm not like '%MAIL_NOT_FOUND%' then raise;end if;end;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
r:=public.manage_game_mail(a.l,1,'mail-qa','mail-qa','claim',m);
r:=public.manage_game_mail(a.l,1,'mail-qa','mail-qa','claim',m);
if (select count(*) from jsonb_array_elements(r->'economy'->'assets') x where x->>'itemId' like 'equipment_v2:%-mail-gear-%')<>5 then raise exception 'Claim replay duplicated reward';end if;
if (r->'economy'->'wallet'->>'silver')::bigint<>105000 then raise exception 'Expiry replayed sale proceeds';end if;
end $$;
reset role;
update private.game_mail set expires_at=now()-interval '1 second' where user_id in(select u from mail_fixture);
select private.maintain_game_mail();
do $$begin if exists(select 1 from private.game_mail where user_id in(select u from mail_fixture)) then raise exception 'Expired mail retained';end if;end $$;
rollback;
