-- Run as privileged test owner; fixture mutations roll back inside a subtransaction.
do $test$
declare
 u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();l uuid:=gen_random_uuid();
 x uuid:=gen_random_uuid();y uuid:=gen_random_uuid();good_mail uuid;bad_mail uuid;
 order_id uuid:=gen_random_uuid();gold_order uuid:=gen_random_uuid();request_id uuid:=gen_random_uuid();
 b bigint;rev bigint;
begin
 begin
  good_mail:=least(x,y);bad_mail:=greatest(x,y);
  insert into auth.users(id) values(u);
  insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
  insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
  values(u,l,s,'atomicity-qa','atomicity-qa','QA','security-test',1,now(),now(),now()+interval '1 hour');
  insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
  values(u,1,23,'security-test',private.server_bootstrap_payload('{}')||'{"version":23,"silver":1000,"market":{"gold":0},"expedition":null}'::jsonb,'qa');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s)::text,true);
  insert into private.game_mail(mail_id,user_id,event_key,category,title,attachment_item_id,attachment_quantity,attachment_reward)
  values(good_mail,u,'qa:good','reward','Synthetic good','reward:coupon',1,'{"silver":50,"items":[{"id":"other:job_draw_ticket","quantity":1}]}'),
        (bad_mail,u,'qa:bad','reward','Synthetic invalid','reward:coupon',1,'{"silver":-1}');
  begin
   perform public.manage_game_mail(l,1,'atomicity-qa','atomicity-qa','claim_all',null);
   raise exception 'TEST_BAD_BATCH_ACCEPTED';
  exception when others then if sqlerrm<>'COUPON_REWARD_INVALID' then raise;end if;end;
  if (select silver from private.player_wallets where user_id=u)<>1000
   or (select revision from public.game_saves where user_id=u)<>1
   or exists(select 1 from private.game_mail where user_id=u and claimed_at is not null)
   or exists(select 1 from private.market_assets where user_id=u and item_id='other:job_draw_ticket' and quantity>0)
  then raise exception 'TEST_PARTIAL_BATCH_RETAINED_REWARD';end if;

  -- Model escrow on an isolated BUY order. The uncommitted order is never visible to other players.
  update private.player_wallets set silver=silver-100 where user_id=u;
  insert into private.market_orders(order_id,user_id,item_id,side,limit_price,original_quantity,remaining_quantity,status)
  values(order_id,u,'other:job_draw_ticket','BUY',10,10,10,'OPEN');
  perform public.cancel_online_market_order(l,1,'atomicity-qa','atomicity-qa',order_id);
  begin
   perform public.cancel_online_market_order(l,1,'atomicity-qa','atomicity-qa',order_id);
   raise exception 'TEST_MARKET_CANCEL_REPLAY_ACCEPTED';
  exception when others then if sqlerrm<>'ORDER_NOT_CANCELLABLE' then raise;end if;end;
  if (select silver from private.player_wallets where user_id=u)<>1000
   or (select count(*) from private.game_mail where user_id=u and event_key='order:'||order_id::text)<>1
  then raise exception 'TEST_MARKET_REFUND_DUPLICATED';end if;

  update private.player_wallets set silver=silver-100 where user_id=u;
  insert into private.gold_exchange_orders(order_id,user_id,side,price_silver_per_gold,original_gold_quantity,remaining_gold_quantity,status)
  values(gold_order,u,'BUY_GOLD',20,5,5,'OPEN');
  perform public.cancel_online_gold_exchange_order(l,1,'atomicity-qa','atomicity-qa',request_id,gold_order);
  perform public.cancel_online_gold_exchange_order(l,1,'atomicity-qa','atomicity-qa',request_id,gold_order);
  begin
   perform public.cancel_online_gold_exchange_order(l,1,'atomicity-qa','atomicity-qa',gen_random_uuid(),gold_order);
   raise exception 'TEST_GOLD_CANCEL_REPLAY_ACCEPTED';
  exception when others then if sqlerrm<>'GOLD_EXCHANGE_ORDER_NOT_CANCELLABLE' then raise;end if;end;
  if (select silver from private.player_wallets where user_id=u)<>1000
   or (select count(*) from private.gold_exchange_cancel_requests where user_id=u)<>1
  then raise exception 'TEST_GOLD_REFUND_DUPLICATED';end if;

  raise exception using errcode='ZQ001',message='ROLLBACK_SYNTHETIC_FIXTURE';
 exception when sqlstate 'ZQ001' then null;
 end;
end $test$;
select 'PASS: failed reward batch is atomic; market/gold cancellation refunds once; all fixture writes rolled back' as result;
