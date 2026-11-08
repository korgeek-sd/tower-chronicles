-- Run against a migrated database as a privileged integration fixture.
-- Creates only synthetic auth users and fully rolls back every change.
begin;
do $test$
declare
 u uuid := gen_random_uuid();
 buy_id uuid;
 sell_id uuid;
 filled_id uuid;
 mail_count integer;
 r record;
begin
 insert into auth.users(id) values(u);
 insert into private.gold_exchange_orders
   (user_id,side,price_silver_per_gold,original_gold_quantity,remaining_gold_quantity,status,seller_fee_bps)
 values(u,'BUY_GOLD',100,10,7,'PARTIAL',0) returning order_id into buy_id;
 select count(*) into mail_count from private.game_mail where user_id=u;
 if mail_count<>0 then raise exception 'Mail sent before cancellation';end if;

 update private.gold_exchange_orders set status='CANCELLED',updated_at=now() where order_id=buy_id;
 select * into r from private.game_mail where user_id=u and event_key='gold-exchange-cancel:'||buy_id::text;
 if not found then raise exception 'Missing buy cancellation mail';end if;
 if r.title<>'골드 매수 주문 취소' or r.category<>'trade'
 or (r.details->>'filledGoldQuantity')::bigint<>3
 or (r.details->>'cancelledGoldQuantity')::bigint<>7
 or (r.details->>'returnedSilver')::bigint<>700
 or r.attachment_item_id is not null
 or position('반환 실버: 700 실버' in r.body)=0
 then raise exception 'Buy cancellation mail is incorrect';end if;

 update private.gold_exchange_orders set status='CANCELLED' where order_id=buy_id;
 select count(*) into mail_count from private.game_mail where user_id=u;
 if mail_count<>1 then raise exception 'Duplicate cancellation mail';end if;

 insert into private.gold_exchange_orders
 (user_id,side,price_silver_per_gold,original_gold_quantity,remaining_gold_quantity,status,seller_fee_bps)
 values(u,'SELL_GOLD',1000,10,10,'OPEN',200) returning order_id into sell_id;
 update private.gold_exchange_orders set status='CANCELLED' where order_id=sell_id;
 select * into r from private.game_mail where user_id=u and event_key='gold-exchange-cancel:'||sell_id::text;
 if not found or r.title<>'골드 매도 주문 취소'
 or (r.details->>'returnedGold')::bigint<>10
 or (r.details->>'returnedSilver')::bigint<>0
 or position('반환 골드: 10 골드' in r.body)=0
 then raise exception 'Sell cancellation mail is incorrect';end if;

 insert into private.gold_exchange_orders
 (user_id,side,price_silver_per_gold,original_gold_quantity,remaining_gold_quantity,status,seller_fee_bps)
 values(u,'BUY_GOLD',250,5,5,'OPEN',0) returning order_id into filled_id;
 update private.gold_exchange_orders set remaining_gold_quantity=0,status='FILLED' where order_id=filled_id;
 select count(*) into mail_count from private.game_mail where user_id=u;
 if mail_count<>2 then raise exception 'Non-cancellation created mail';end if;
end
$test$;
rollback;
