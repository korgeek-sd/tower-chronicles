import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('mail claims isolate owners, reject expired mail, replay once and roll back a failed reward batch',async()=>{
 const db=new PGlite();
 try{
  await db.exec(read('./couponDatabaseFixture.sql'));
  const mail=read('../supabase/migrations/20261001132943_game_mail.sql');
  await db.exec(mail.slice(mail.indexOf('create table private.game_mail'),mail.indexOf('alter table private.market_orders')));
  await db.exec("alter table private.game_mail add column attachment_assets jsonb not null default '[]';");
  await db.exec(mail.slice(mail.indexOf('create or replace function private.deliver_market_asset'),mail.indexOf('create or replace function private.market_order_mail')));
  await db.exec(read('../supabase/migrations/20261002074216_coupon_redemption.sql'));
  await db.exec(read('../supabase/tests/mail_claim_security.sql'));
  assert.equal((await db.query<{n:number}>('select count(*)::int n from auth.users')).rows[0].n,0);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.game_mail')).rows[0].n,0);
 }finally{await db.close();}
});
