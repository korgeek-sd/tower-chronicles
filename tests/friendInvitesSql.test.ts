import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('friend invites preserve one-time claims and cap owner rewards while rewarding later invitees',async()=>{
 const db=new PGlite();
 try{
 await db.exec(read('./couponDatabaseFixture.sql'));
 await db.exec('create table public.game_player_profiles(user_id uuid primary key references auth.users(id) on delete cascade);');
 const mail=read('../supabase/migrations/20261001132943_game_mail.sql');
 await db.exec(mail.slice(mail.indexOf('create table private.game_mail'),mail.indexOf('alter table private.market_orders')));
 await db.exec("alter table private.game_mail add column attachment_reward jsonb not null default '{}'; insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'); insert into public.game_player_profiles values ('00000000-0000-0000-0000-000000000001');");
 await db.exec(read('../supabase/migrations/20261003050924_friend_invites.sql'));
 const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const login=async(n:number)=>{await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid(n)})]);};
 const state=async()=> (await db.query<{s:any}>('select public.get_friend_invite_state() s')).rows[0].s;
 const apply=async(code:string)=>(await db.query<{s:any}>('select public.apply_friend_invite_code($1) s',[code])).rows[0].s;
 await assert.rejects(state,/INVITE_AUTH_REQUIRED/);
 await login(1);const owner=await state();assert.match(owner.code,/^TC-[A-F0-9]{12}$/);assert.equal((await state()).code,owner.code);
 await assert.rejects(()=>apply(owner.code),/INVITE_SELF_FORBIDDEN/);
 await assert.rejects(()=>apply('TC-000000000000'),/INVITE_CODE_INVALID/);
 for(let n=2;n<=104;n++){await db.query('insert into auth.users(id) values ($1)',[uid(n)]);if(n!==104)await db.query('insert into public.game_player_profiles values ($1)',[uid(n)]);}
 await login(104);await assert.rejects(state,/INVITE_PROFILE_REQUIRED/);
 assert.equal((await db.query<{c:number}>('select count(distinct code)::int c from private.friend_invite_codes')).rows[0].c,103);
 await login(2);assert.equal((await apply(' '+owner.code.toLowerCase()+' ')).duplicate,false);assert.equal((await apply(owner.code)).duplicate,true);
 assert.equal((await db.query<{q:number}>("select (attachment_reward->'items'->0->>'quantity')::int q from private.game_mail where user_id=$1",[uid(2)])).rows[0].q,50);
 assert.equal((await db.query<{q:number}>("select (attachment_reward->'items'->0->>'quantity')::int q from private.game_mail where user_id=$1",[uid(1)])).rows[0].q,10);
 const own2=(await state()).code;await assert.rejects(()=>apply(own2),/INVITE_ALREADY_APPLIED/);
 await db.query('delete from private.game_mail where user_id=$1',[uid(2)]);assert.equal((await apply(owner.code)).duplicate,true);
 assert.equal((await db.query<{c:number}>('select count(*)::int c from private.game_mail where user_id=$1',[uid(2)])).rows[0].c,0);
 for(let n=3;n<=101;n++){await login(n);await apply(owner.code);}
 await login(1);assert.equal((await state()).rewardedInvites,100);
 await login(102);await apply(owner.code);
 assert.equal((await db.query<{rewarded:boolean}>('select inviter_rewarded rewarded from private.friend_invite_claims where invitee_id=$1',[uid(102)])).rows[0].rewarded,false);
 assert.equal((await db.query<{c:number}>('select count(*)::int c from private.game_mail where user_id=$1',[uid(1)])).rows[0].c,100);
 assert.equal((await db.query<{q:number}>("select (attachment_reward->'items'->0->>'quantity')::int q from private.game_mail where user_id=$1",[uid(102)])).rows[0].q,50);
 await db.query('delete from auth.users where id=$1',[uid(1)]);assert.equal((await apply(owner.code)).duplicate,true);
 await assert.rejects(()=>apply(own2),/INVITE_ALREADY_APPLIED/);
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from private.friend_invite_codes'),/permission denied/);
 }finally{await db.close();}
});
