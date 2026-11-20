-- Route newly matched adventurer boxes to the buyer's claimable storage.
do $migration$
declare
  definition text := pg_get_functiondef('public.place_online_market_order(uuid,bigint,text,text,text,text,bigint,bigint)'::regprocedure);
  original text := $original$    else perform private.deliver_market_asset(v_buy.user_id,v_buy.item_id,v_qty,v_sell.gear);end if;$original$;
  replacement text := $replacement$    elsif v_buy.item_id = 'product:life:adventurer_box' then
      insert into private.market_storage(user_id, trade_id, side, item_id, quantity)
      values (v_buy.user_id, v_trade_id, 'BUY', v_buy.item_id, v_qty);
    else
      perform private.deliver_market_asset(v_buy.user_id,v_buy.item_id,v_qty,v_sell.gear);
    end if;$replacement$;
begin
  if strpos(definition, replacement) > 0 then return; end if;
  if array_length(string_to_array(definition, original), 1) <> 2 then
    raise exception 'Expected exactly one market delivery branch';
  end if;
  execute replace(definition, original, replacement);
end
$migration$;
