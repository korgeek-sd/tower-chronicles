import test from 'node:test';
import assert from 'node:assert/strict';
import {
 OCCUPATION_RULES,losingBidRefund,occupationFrontWinner,occupationWindow,validOccupationBidAmount,
} from '../src/game/occupation/rules.ts';

const kst=(value:string)=>Date.parse(value+'+09:00');

test('OCCUPATION RULES 01: bidding is Monday 00:00 through Friday 22:00 KST',()=>{
 assert.equal(occupationWindow(kst('2026-09-28T00:00:00')).phase,'BIDDING');
 assert.equal(occupationWindow(kst('2026-10-02T21:59:59')).phase,'BIDDING');
 assert.equal(occupationWindow(kst('2026-10-02T22:00:00')).phase,'LOCKED');
 assert.equal(occupationWindow(kst('2026-09-28T12:00:00')).cycleKey,'2026-09-28');
});

test('OCCUPATION RULES 02: battle is Saturday 22:00 to 22:30 KST only',()=>{
 assert.equal(occupationWindow(kst('2026-10-03T21:59:59')).phase,'LOCKED');
 assert.equal(occupationWindow(kst('2026-10-03T22:00:00')).phase,'BATTLE');
 assert.equal(occupationWindow(kst('2026-10-03T22:29:59')).phase,'BATTLE');
 assert.equal(occupationWindow(kst('2026-10-03T22:30:00')).phase,'SETTLED');
});

test('OCCUPATION RULES 03: each bid is 10 to 100 merit and guild cooldown is 30 minutes',()=>{
 assert.equal(validOccupationBidAmount(9),false);
 assert.equal(validOccupationBidAmount(10),true);
 assert.equal(validOccupationBidAmount(100),true);
 assert.equal(validOccupationBidAmount(101),false);
 assert.equal(OCCUPATION_RULES.bidCooldownMs,30*60_000);
});

test('OCCUPATION RULES 04: losing bid refunds floor 50 percent while winner consumes all',()=>{
 assert.equal(losingBidRefund(10),5);
 assert.equal(losingBidRefund(11),5);
 assert.equal(losingBidRefund(101),50);
});

test('OCCUPATION RULES 05: the first side to secure two of three fronts wins',()=>{
 assert.equal(occupationFrontWinner({LEFT:'ATTACKER',CENTER:'ATTACKER',RIGHT:'OPEN'}),'ATTACKER');
 assert.equal(occupationFrontWinner({LEFT:'DEFENDER',CENTER:'OPEN',RIGHT:'DEFENDER'}),'DEFENDER');
 assert.equal(occupationFrontWinner({LEFT:'ATTACKER',CENTER:'DEFENDER',RIGHT:'OPEN'}),'OPEN');
});
