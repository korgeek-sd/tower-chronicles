-- v0.1.64: allow V2 equipment relisting after terminal listing states and cover FK indexes.

alter table private.equipment_market_listings
drop constraint if exists equipment_market_listings_asset_item_id_key;

create unique index if not exists equipment_market_open_asset_unique_idx
on private.equipment_market_listings(asset_item_id)
where status='OPEN';

create index if not exists equipment_market_listings_buyer_idx
on private.equipment_market_listings(buyer_id)
where buyer_id is not null;

create index if not exists equipment_market_trades_buyer_idx
on private.equipment_market_trades(buyer_id);

create index if not exists equipment_market_trades_seller_idx
on private.equipment_market_trades(seller_id);
