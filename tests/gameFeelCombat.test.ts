import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {CombatEvent} from '../src/game/types.ts';
import {combatFeelForEvent} from '../src/gameFeel/combatAdapter.ts';

const hit=(over:Partial<CombatEvent>={}):CombatEvent=>({
 id:1,kind:'DIRECT_DAMAGE',attacker:'player',target:'monster',
 hitIndex:1,hitCount:1,incomingDamage:10,absorbedByShield:0,hpDamage:10,critical:false,
 ...over,
});

test('GAME FEEL COMBAT 01: ordinary and critical player hits map to distinct semantic events',()=>{
 assert.deepEqual(combatFeelForEvent(hit(),180),[{event:'combat.basic-hit'}]);
 assert.deepEqual(combatFeelForEvent(hit({critical:true}),180),[{event:'combat.critical-hit'}]);
});

test('GAME FEEL COMBAT 02: player damage intensity scales from authoritative HP damage',()=>{
 assert.deepEqual(combatFeelForEvent(hit({attacker:'monster',target:'player',hpDamage:8,incomingDamage:8}),200),[
  {event:'combat.player-damaged',payload:{intensity:'normal'}},
 ]);
 assert.deepEqual(combatFeelForEvent(hit({attacker:'monster',target:'player',hpDamage:70,incomingDamage:70}),200),[
  {event:'combat.player-damaged',payload:{intensity:'strong'}},
 ]);
});

test('GAME FEEL COMBAT 03: shield absorption emits guard before any remaining player damage',()=>{
 assert.deepEqual(combatFeelForEvent(hit({attacker:'monster',target:'player',incomingDamage:40,absorbedByShield:25,hpDamage:15}),200),[
  {event:'combat.guard'},
  {event:'combat.player-damaged',payload:{intensity:'normal'}},
 ]);
});

test('GAME FEEL COMBAT 04: full shield absorption does not emit false damage',()=>{
 assert.deepEqual(combatFeelForEvent(hit({attacker:'monster',target:'player',incomingDamage:30,absorbedByShield:30,hpDamage:0}),200),[
  {event:'combat.guard'},
 ]);
});

test('GAME FEEL COMBAT 05: BattleScreen processes each structured combat event once',()=>{
 const source=readFileSync(new URL('../src/components/battle/BattleScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/useGameFeel/);
 assert.match(source,/lastFeelEventId/);
 assert.match(source,/combatFeelForEvent/);
 assert.match(source,/event\.id>lastFeelEventId\.current/);
});

test('GAME FEEL COMBAT 06: heal and death feedback comes from resolved state deltas',()=>{
 const source=readFileSync(new URL('../src/components/battle/BattleScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/combat\.heal/);
 assert.match(source,/combat\.death/);
 assert.match(source,/previousPlayerHp/);
 assert.doesNotMatch(source,/Math\.random\(/);
});
