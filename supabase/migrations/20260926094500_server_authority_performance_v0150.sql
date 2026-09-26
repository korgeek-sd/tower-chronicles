-- v0.1.50 final server-authority performance cleanup.
-- Cover market trade ownership foreign keys used by settlement/history queries.
create index if not exists market_trades_buyer_id_idx on private.market_trades(buyer_id);
create index if not exists market_trades_seller_id_idx on private.market_trades(seller_id);
