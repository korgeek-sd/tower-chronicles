import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('coupon SQL enforces authorization, expiry, global limits and one-time reward mail collection',async()=>{
 const db=new PGlite();
 try{
 await db.exec(read('./couponDatabaseFixture.sql'));
 const mail=read('../supabase/migrations/20261001132943_game_mail.sql');
 await db.exec(mail.slice(mail.indexOf('create table private.game_mail'),mail.indexOf('alter table private.market_orders')));
 await db.exec('alter table private.game_mail add column attachment_assets jsonb not null default \'[]\';');
 await db.exec(mail.slice(mail.indexOf('create or replace function private.deliver_market_asset'),mail.indexOf('create or replace function private.market_order_mail')));
 await db.exec(read('../supabase/migrations/20261002074216_coupon_redemption.sql'));
 await db.exec(read('../supabase/tests/coupons.sql'));
 assert.equal((await db.query<{count:number}>('select count(*)::integer as count from private.coupon_claims')).rows[0].count,0);
 }finally{await db.close();}
});

