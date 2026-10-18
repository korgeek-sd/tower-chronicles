import test from 'node:test';
import assert from 'node:assert/strict';
import {premiumRemaining} from '../src/components/PremiumStatus';
test('premium header switches at expiry and rounds partial remaining days up',()=>{
 const now=100000;
 assert.equal(premiumRemaining(null,now),null);
 assert.equal(premiumRemaining(now,now),null);
 assert.equal(premiumRemaining(now-1,now),null);
 assert.equal(premiumRemaining(now+1,now),'1일 남음');
 assert.equal(premiumRemaining(now+27*86400000,now),'27일 남음');
 assert.equal(premiumRemaining(now+86400001,now),'2일 남음');
});

import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('header status is authenticated and reads only the current account',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create table private.premium_accounts(user_id uuid,expires_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;insert into private.premium_accounts values('11111111-1111-4111-8111-111111111111',now()+interval '27 days');`);
 await db.exec(readFileSync(new URL('../supabase/premium-status.sql',import.meta.url),'utf8'));
 await assert.rejects(()=>db.query('select public.get_premium_status()'),/AUTH_REQUIRED/);
 await db.exec(`set test.uid='22222222-2222-4222-8222-222222222222'`);
 assert.equal((await db.query<any>('select public.get_premium_status() value')).rows[0].value.expiresAt,null);
 await db.exec(`set test.uid='11111111-1111-4111-8111-111111111111'`);
 const value=(await db.query<any>('select public.get_premium_status() value')).rows[0].value;
 assert.equal(premiumRemaining(value.expiresAt,value.serverNow),'27일 남음');
 assert.equal((await db.query<any>(`select has_function_privilege('anon','public.get_premium_status()','EXECUTE') ok`)).rows[0].ok,false);
 }finally{await db.close();}
});
