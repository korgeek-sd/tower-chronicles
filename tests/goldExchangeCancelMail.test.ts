import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration='supabase/migrations/20261108013425_gold_exchange_cancel_notification_mail.sql';

test('GOLD EXCHANGE CANCEL MAIL: server trigger creates a unique trade notice only on open or partial cancellation',()=>{
 const sql=read(migration);
 assert.match(sql,/create trigger gold_exchange_cancel_mail/i);
 assert.match(sql,/after update of status on private\.gold_exchange_orders/i);
 assert.match(sql,/old\.status in \('OPEN', 'PARTIAL'\)/i);
 assert.match(sql,/new\.status = 'CANCELLED'/i);
 assert.match(sql,/new\.remaining_gold_quantity > 0/i);
 assert.match(sql,/gold-exchange-cancel:/);
 assert.match(sql,/on conflict \(user_id, event_key\) do nothing/i);
 assert.match(sql,/'trade'/);
 assert.match(sql,/'골드 매수 주문 취소'/);
 assert.match(sql,/'골드 매도 주문 취소'/);
 assert.match(sql,/'returnedSilver'/);
 assert.match(sql,/'returnedGold'/);
 assert.match(sql,/revoke all on function private\.mail_on_gold_exchange_cancel\(\)/i);
 assert.doesNotMatch(sql,/attachment_item_id|attachment_quantity|attachment_reward/i);
});

test('GOLD EXCHANGE CANCEL MAIL: clients see server-authored notice and immediate unread-mail refresh',()=>{
 const mail=read('src/online/mail.ts');
 const gold=read('src/components/market/GoldExchangeScreen.tsx');
 const app=read('src/main.tsx');
 assert.match(mail,/mail\.details\?\.kind==='gold_exchange_cancel'/);
 assert.match(gold,/await cancelOnlineGoldExchangeOrder\(onlineLease,orderId\)/);
 assert.match(gold,/window\.dispatchEvent\(new Event\('tc-game-mail-updated'\)\)/);
 assert.match(app,/window\.addEventListener\('tc-game-mail-updated',refresh\)/);
 assert.match(app,/window\.removeEventListener\('tc-game-mail-updated',refresh\)/);
});

test('GOLD EXCHANGE CANCEL MAIL: rollback-only integration fixture covers non-cancelled and repeat cases',()=>{
 const fixture=read('supabase/tests/gold_exchange_cancel_mail.sql');
 assert.match(fixture,/begin;/i);
 assert.match(fixture,/rollback;/i);
 assert.match(fixture,/original_gold_quantity,remaining_gold_quantity,status/);
 assert.match(fixture,/mail_count<>1/);
 assert.match(fixture,/mail_count<>2/);
 assert.match(fixture,/returnedSilver/);
 assert.match(fixture,/returnedGold/);
});
