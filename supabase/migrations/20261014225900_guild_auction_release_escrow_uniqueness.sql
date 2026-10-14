-- Only equipment currently held in auction escrow is unique; returned or claimed equipment may be listed again.
drop index if exists private.guild_auction_escrow_asset_key;
create unique index guild_auction_escrow_asset_key
 on private.guild_auction_listings(asset_item_id)
 where asset_item_id is not null and returned_at is null and claimed_at is null;
