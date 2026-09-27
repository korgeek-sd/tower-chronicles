create index if not exists gold_exchange_order_requests_order_idx on private.gold_exchange_order_requests(order_id);
create index if not exists gold_exchange_cancel_requests_order_idx on private.gold_exchange_cancel_requests(order_id);
create index if not exists gold_exchange_trades_buy_order_idx on private.gold_exchange_trades(buy_order_id);
create index if not exists gold_exchange_trades_sell_order_idx on private.gold_exchange_trades(sell_order_id);
