import test from 'node:test';
import assert from 'node:assert/strict';
import type {GameState,Weapon} from '../src/game/types.ts';
import {WEAPONS,PASSIVES} from '../src/game/data/config.ts';
import {initialState,stats} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {basicAttack,damage,useBattleSkill} from '../src/game/engine/combat.ts';
import {resolveActorDirectHits} from '../src/game/engine/monsterSkills.ts';
import {resolveDirectHits} from '../src/game/engine/directHits.ts';
import {activeShield,applyEffect,effectStacks,periodicDelta} from '../src/game/engine/effects.ts';
import {beginEncounter} from '../src/game/events/service.ts';
import {bossIdFor} from '../src/game/engine/bossTracking.ts';

const noCrit=()=>.99;
function withWeapon(weapon:Weapon,tier=1){const s=initialState();s.items.push({id:'test-weapon',kind:weapon,tier,enhancement:0});s.equipped.weapon='test-weapon';return s;}
function battle(weapon:Weapon){const s=enter(withWeapon(weapon),'ore',1);s.expedition!.monster.hp=10000;s.expedition!.monster.currentHp=10000;return s;}
function rolls(...values:number[]){let index=0;return ()=>values[index++]??.99;}

 test('CRITICAL 01: canonical weapon identities are grade-independent',()=>{for(const tier of [1,5]){assert.equal(stats(withWeapon('sword',tier)).critChance,.05);assert.equal(stats(withWeapon('dagger',tier)).critChance,.2);assert.equal(stats(withWeapon('bow',tier)).critChance,.05);assert.equal(stats(withWeapon('staff',tier)).critChance,.05);}for(const weapon of ['sword','dagger','bow','staff'] as Weapon[])assert.equal(WEAPONS[weapon].critDamage,1.5);assert.deepEqual(WEAPONS.bow.basicHitMultipliers,[.55,.55]);assert.equal(WEAPONS.staff.skillPower,1.3);});

test('CRITICAL 02: defense resolves before forced normal/critical multiplication',()=>{assert.equal(damage(100,20,1,1),80);assert.equal(damage(100,20,1,1.5),120);});

test('CRITICAL 03: each bow hit rolls independently across all four outcomes',()=>{const cases:[[number,number],boolean[]][]=[[[.9,.9],[false,false]],[[0,.9],[true,false]],[[.9,0],[false,true]],[[0,0],[true,true]]];for(const [sequence,expected] of cases){const s=battle('bow'),result=resolveActorDirectHits(s,'player',2,.55,true,rolls(...sequence),2);assert.deepEqual(result.resolutions.map(hit=>hit.critical),expected);assert.equal(result.hits.length,2);}});

test('BOW 04: one basic action produces two 55% sequential hit logs',()=>{const s=battle('bow'),turn=s.expedition!.playerTurn,n=basicAttack(s,noCrit);assert.equal(n.expedition!.phase,'MONSTER_TURN');assert.equal(n.expedition!.playerTurn,turn);assert.equal(n.logs.filter(line=>line.includes('당신의 활 공격')).length,2);assert.equal(WEAPONS.bow.basicHitMultipliers.reduce((a,b)=>a+b,0),1.1);});

test('BOW 05: flat defense burden is split and damage shields resolve sequentially',()=>{const s=battle('bow'),e=s.expedition!,attack=stats(s,e.equipment).attack;e.monster.defense=20;const hits=resolveActorDirectHits(s,'player',2,.55,true,noCrit,2);assert.deepEqual(hits.resolutions.map(x=>x.incomingDamage),[Math.floor(Math.max(1,attack*.55-10)),Math.floor(Math.max(1,attack*.55-10))]);applyEffect(e,'monster','test_shield','monster',0);activeShield(e,'monster')!.currentShield=100;const shielded=resolveDirectHits(e,'player','monster',2,()=>60);assert.deepEqual(shielded.resolutions.map(x=>[x.shieldAfter,x.hpDamage]),[[40,0],[0,20]]);});

test('BOW 06: a two-charge hit shield is removed by one two-hit attack',()=>{const s=battle('bow'),e=s.expedition!;applyEffect(e,'monster','test_hit_shield','monster',0);const result=resolveDirectHits(e,'player','monster',2,()=>60);assert.deepEqual(result.resolutions.map(x=>[x.shieldBefore,x.shieldAfter,x.hpDamage]),[[2,1,0],[1,0,0]]);assert.equal(activeShield(e,'monster'),undefined);});

test('STAFF 07: basic is unmodified, direct skills and every direct skill hit receive 1.30, DOT does not',()=>{const s=battle('staff'),e=s.expedition!,attack=stats(s,e.equipment).attack;e.monster.defense=0;const basic=resolveActorDirectHits(s,'player',1,1,true,noCrit);assert.equal(basic.incomingTotal,Math.floor(attack));e.monster.currentHp=e.monster.hp;const skill=resolveActorDirectHits(s,'player',2,1.3,true,noCrit);assert.deepEqual(skill.resolutions.map(x=>x.incomingDamage),[Math.floor(attack*1.3),Math.floor(attack*1.3)]);applyEffect(e,'monster','poison','player',e.monsterTurn-1);assert.equal(periodicDelta(e,'monster',e.monster.hp,e.monsterTurn),-5);});

test('DOT 08: poison and bleed use periodic fixed damage outside critical resolution',()=>{const s=battle('staff'),e=s.expedition!;applyEffect(e,'monster','poison','player',e.monsterTurn-1);applyEffect(e,'monster','bleed','player',e.monsterTurn-1);assert.equal(periodicDelta(e,'monster',e.monster.hp,e.monsterTurn),-10);});

test('BERSERKER/LIFESTEAL 09: berserker applies once and lifesteal uses post-shield HP damage',()=>{let s=withWeapon('sword');s.items.push({id:'passive',kind:'berserker',tier:1,enhancement:0});s.equipped.accessory='passive';s=enter(s,'ore',1);let e=s.expedition!;e.monster.hp=10000;e.monster.currentHp=10000;e.monster.defense=0;e.hp=stats(s,e.equipment).hp*.4;const attack=stats(s,e.equipment).attack,hit=resolveActorDirectHits(s,'player',1,1,true,noCrit);assert.equal(hit.incomingTotal,Math.floor(attack*(1+PASSIVES.berserker.value)));s=withWeapon('sword');s.items.push({id:'passive',kind:'vampire',tier:1,enhancement:0});s.equipped.accessory='passive';s=enter(s,'ore',1);e=s.expedition!;e.monster.hp=10000;e.monster.currentHp=10000;e.monster.defense=0;e.hp=50;applyEffect(e,'monster','test_shield','monster',0);activeShield(e,'monster')!.currentShield=10;const expectedHpDamage=Math.max(0,Math.floor(stats(s,e.equipment).attack)-10);const n=basicAttack(s,noCrit);assert.equal(n.expedition!.hp,50+expectedHpDamage*PASSIVES.vampire.value);});

test('IRON 10: 7F bow basic creates two fracture stacks while DOT creates none',()=>{const base=withWeapon('bow');base.tickets.ore[6]=1;let s=enter(base,'ore',7);s=beginEncounter(s,noCrit,bossIdFor('ore',7));s=basicAttack(s,noCrit);assert.equal(effectStacks(s.expedition!.monsterEffects,'fracture'),2);const before=effectStacks(s.expedition!.monsterEffects,'fracture');applyEffect(s.expedition!,'monster','poison','player',s.expedition!.monsterTurn-1);assert.equal(effectStacks(s.expedition!.monsterEffects,'fracture'),before);});

test('STAFF 11: the production offensive skill uses 130% while non-damage skills remain unchanged',()=>{let s=battle('staff'),e=s.expedition!;e.monster.defense=0;const attack=stats(s,e.equipment).attack;s=useBattleSkill(s,'heavy',noCrit);assert.equal(s.logs.some(line=>line.includes(Math.floor(attack*2*1.3)+' 피해')),true);const guard=battle('staff');guard.expedition!.hp=stats(guard,guard.expedition!.equipment).hp*.5;const effects=guard.expedition!.playerEffects.length,n=useBattleSkill(guard,'guard',noCrit);assert.equal(n.expedition!.playerEffects.length,effects+1);});