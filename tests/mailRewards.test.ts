import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state';
import {mailBody} from '../src/online/mail';
import {applyMailRewards} from '../src/online/mailRewards';
import type {MailState} from '../src/online/mail';
test('mail displays appearance tickets alongside silver and gold',()=>{
 const text=mailBody({title:'운영팀 지급 보상',category:'reward',body:'선물',details:{} as any,attachment:{itemId:'coupon_reward',quantity:1,gear:null,reward:{silver:10000,gold:10000,appearanceTickets:100}}});
 assert.match(text,/10,000 실버/);assert.match(text,/10,000 골드/);assert.match(text,/외형 소환권 × 100장/);
});
test('claim applies authoritative currency and ticket balances together without double granting',()=>{
 const game=initialState();game.cosmetics.summonTickets=5;
 const response={mails:[],summonTickets:105,economy:{wallet:{silver:10000,gold:20000,revision:1},assets:[]}} as unknown as MailState;
 const next=applyMailRewards(game,response);
 assert.equal(next.silver,10000);assert.equal(next.market.gold,20000);assert.equal(next.cosmetics.summonTickets,105);
 assert.deepEqual(applyMailRewards(next,response),next);assert.equal(game.cosmetics.summonTickets,5);
});
test('reading mail does not deliver rewards; zero authoritative tickets replaces stale balance',()=>{
 const game=initialState();game.cosmetics.summonTickets=5;
 assert.equal(applyMailRewards(game,{mails:[]}),game);
 assert.equal(applyMailRewards(game,{mails:[],summonTickets:0}).cosmetics.summonTickets,0);
});
