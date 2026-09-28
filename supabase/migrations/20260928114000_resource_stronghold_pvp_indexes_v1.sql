-- v0.1.67: cover every resource stronghold PvP foreign key used by cleanup and moderation.
create index if not exists resource_stronghold_contests_challenger_idx
 on private.resource_stronghold_contests(challenger_user_id);
create index if not exists resource_stronghold_contests_request_idx
 on private.resource_stronghold_contests(request_id);
create index if not exists resource_stronghold_contests_winner_idx
 on private.resource_stronghold_contests(winner_user_id) where winner_user_id is not null;
create index if not exists resource_stronghold_receipts_recipient_idx
 on private.resource_stronghold_loot_receipts(recipient_user_id);
create index if not exists resource_stronghold_requests_requester_idx
 on private.resource_stronghold_requests(requester_user_id);
create index if not exists resource_stronghold_requests_stronghold_idx
 on private.resource_stronghold_requests(stronghold_id) where stronghold_id is not null;
create index if not exists resource_strongholds_active_contest_idx
 on private.resource_strongholds(active_contest_id) where active_contest_id is not null;
