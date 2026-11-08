import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261108030000_game_notifications_and_gold_expiry.sql');
const events=read('supabase/migrations/20261108031500_game_notification_auction_war_events.sql');
const dispatch=read('supabase/migrations/20261108033000_secure_game_push_dispatch.sql');

test('notification history has server-owned access and user-scoped reads',()=>{
 assert.match(migration,/create table if not exists private\.game_notifications/i);
 assert.match(migration,/alter table private\.game_notifications enable row level security/i);
 assert.match(migration,/revoke all on private\.game_notifications from public,anon,authenticated/i);
 assert.match(migration,/where user_id=u and read_at is null/i);
 assert.match(migration,/get_game_notifications\(\) to authenticated/i);
 assert.match(migration,/set_game_push_token\(text,text,boolean\) to authenticated/i);
});

test('gold expiry is idempotent, uses market transaction lock, and refunds residual escrow',()=>{
 assert.match(migration,/created_at\+interval '30 days'/i);
 assert.match(migration,/hashtextextended\('GOLD\/SILVER',32\)/);
 assert.match(migration,/for update/i);
 assert.match(migration,/silver=silver\+o\.price_silver_per_gold\*o\.remaining_gold_quantity/i);
 assert.match(migration,/gold=gold\+o\.remaining_gold_quantity/i);
 assert.match(migration,/set status='EXPIRED'/i);
 assert.match(migration,/on conflict\(user_id,event_key\) do nothing/i);
 assert.match(migration,/perform private\.persist_market_economy_to_save\(o\.user_id\)/i);
 assert.match(migration,/tc-gold-exchange-expiry/);
});

test('trade/auction/war/bank events generate server notifications without self-cancel push',()=>{
 assert.match(migration,/gold_trade_notify/);
 assert.match(migration,/bank_ledger_notify/);
 assert.match(events,/guild_auction_notify/);
 assert.match(events,/village_war_declaration_notify/);
 assert.match(events,/village_war_settlement_notify/);
 assert.match(events,/bank_maturity_notify/);
 assert.match(migration,/gold-exchange-cancel:%/);
 assert.match(migration,/mail-expiry:/);
});

test('push sender is service-only, rate-limited, retryable and secrets are not bundled',()=>{
 assert.match(dispatch,/revoke all on function public\.claim_game_push_batch\(integer\) from public,anon,authenticated/i);
 assert.match(dispatch,/grant execute on function public\.claim_game_push_batch\(integer\) to service_role/i);
 assert.match(dispatch,/for update skip locked/i);
 assert.match(dispatch,/push_attempts<5/);
 assert.match(dispatch,/game_push_dispatch_secret/);
 const sender=read('supabase/functions/send-game-push/index.ts');
 assert.match(sender,/GAME_PUSH_DISPATCH_SECRET/);
 assert.match(sender,/FIREBASE_SERVICE_ACCOUNT_JSON/);
 assert.match(sender,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(sender,/oauth2\.googleapis\.com\/token/);
 assert.match(sender,/fcm\.googleapis\.com\/v1\/projects/);
 assert.match(sender,/complete_game_push_delivery/);
 assert.doesNotMatch(read('src/online/nativePush.ts'),/SERVICE_ROLE_KEY|SERVICE_ACCOUNT_JSON/);
});

test('mobile app has notification drawer, push opt-in, deep linking, and logout cleanup',()=>{
 const app=read('src/main.tsx'),native=read('src/online/nativePush.ts'),topbar=read('src/components/mobile/GameTopBar.tsx');
 assert.match(app,/<NotificationDialog/);
 assert.match(app,/setNotificationsUnread/);
 assert.match(app,/tc-game-notification-tap/);
 assert.match(app,/disableNativePush\(onlineSession\.userId\)/);
 assert.match(native,/PushNotifications\.requestPermissions\(\)/);
 assert.match(native,/PushNotifications\.addListener\('registration'/);
 assert.match(native,/PushNotifications\.addListener\('pushNotificationActionPerformed'/);
 assert.match(topbar,/onNotifications/);
 assert.match(topbar,/unreadNotifications/);
});
