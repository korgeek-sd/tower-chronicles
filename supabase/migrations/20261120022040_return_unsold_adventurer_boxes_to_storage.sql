CREATE OR REPLACE FUNCTION private.close_market_order(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o private.market_orders%rowtype;
begin
 select * into o from private.market_orders where order_id=p_id for update;
 if o.status not in('OPEN','PARTIAL') then return;end if;
 if o.side='BUY' then
 perform 1 from public.game_saves where user_id=o.user_id for update;
 update private.player_wallets set silver=silver+o.limit_price*o.remaining_quantity,updated_at=now() where user_id=o.user_id;
 perform private.persist_market_economy_to_save(o.user_id);
 end if;
 -- Store returns as claimable items. The order ID identifies this non-trade settlement.
 if o.side='SELL' and o.item_id='product:life:adventurer_box' and o.remaining_quantity>0 then
  insert into private.market_storage(user_id,trade_id,side,item_id,quantity)
  values(o.user_id,o.order_id,'BUY',o.item_id,o.remaining_quantity);
 elsif o.side='SELL' and (o.item_id like 'material:life:%' or o.item_id like 'product:life:%') and o.remaining_quantity>0 then
  perform private.deliver_market_asset(o.user_id,o.item_id,o.remaining_quantity,null);
 end if;
 perform private.market_order_mail(p_id,p_reason);
 update private.market_orders set status='CANCELLED',updated_at=now() where order_id=p_id;
end $function$;
