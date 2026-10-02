# Game coupons

Players open **Settings → Coupon**, enter a code, and receive one **Coupon reward** mail. Codes ignore case and surrounding spaces. Each account can redeem a coupon once; deleting or allowing the reward mail to expire does not restore eligibility. Redemption checks activation, start/end times, and the global redemption limit on the server. The deadline is exclusive.

The reward mail holds silver, gold, enhancement stones, and job draw tickets as one bundle. It expires after 30 days. Collecting it requires the existing active gameplay lease and being at the hub. Claiming persists the complete reward to the authoritative save in the same transaction as marking the mail claimed. Neither code redemption nor opening the mail pays rewards immediately.

## Administration

Administrators see a creation form and the latest 200 coupons in the same Coupon tab. They can enter a code, display name, start/end dates, optional total usage limit, and reward amounts, and stop/re-enable an existing coupon. Form dates use the device's timezone and are sent to the server as UTC timestamps. The server normalizes the code and validates the configuration again. Existing coupons are immutable except for activation status, preserving the reward promised to players.

The server checks `auth.users.raw_app_meta_data.coupon_admin`, reading the current database value on every administrator call. User metadata, email-based frontend checks, and stale JWT role claims cannot grant this permission. Only trusted Supabase administration should set this field to boolean `true`; never put a service-role key in the client. No administrator is automatically granted by the migration. The designated account is configured separately after operator approval.

## Database rollout

Apply the `coupon_redemption` migration to the existing Tower Chronicles project. It includes the earlier unapplied coupon table foundation, so it works both with and without that foundation already installed. Its CLI-generated UTC filename precedes the old foundation's future timestamp; the old file's `CREATE TABLE IF NOT EXISTS` statements remain safe if run afterwards.

The migration adds a reward attachment to private mail, replaces `get_game_mail` and `manage_game_mail` while preserving equipment-return batches and their lease checks, and adds coupon RPCs. Public and anonymous access is revoked; only authenticated callers can invoke the endpoints, and administration additionally checks the server-owned flag. Regular clients cannot access coupon tables or create reward mail directly.

## Verification

`npm test` includes coupon date boundaries, reward mail rendering, and PostgreSQL integration through PGlite. The SQL suite `supabase/tests/coupons.sql` uses generated synthetic accounts and rolls every write back. It covers administrator spoofing, invalid rewards, normalization, duplicate redemption, future/expired/disabled codes, total limits, foreign mail rejection, delayed payment, replay-safe collection, and persistence after collection.

The local PostgreSQL fixture supplies the pre-existing auth/lease/save/economy interfaces; new coupon RPCs and the mail claim implementation are loaded unchanged from migrations. After deployment, run the SQL suite against the actual project to validate its real existing interfaces too. Local success alone does not confirm production migration or administrator activation.

