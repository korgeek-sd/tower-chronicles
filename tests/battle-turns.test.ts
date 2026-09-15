import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {basicAttack,resolveMonsterTurn,tick,useBattleSkill} from '../src/game/engine/combat.ts';
import {skillTurnsLeft} from '../src/game/engine/turns.ts';
import {createRepository} from '../src/storage/repository.ts';

const start=()=>{const s=enter(initialState(),'ore',1);s.skills=['heavy',null,null];s.expedition!.monster.hp=100000;s.expedition!.monster.currentHp=100000;s.expedition!.monster.attack=0;return s;};
const round=(s:ReturnType<typeof start>)=>resolveMonsterTurn(basicAttack(s));

test('skill cooldown counts player turns and does not expire with elapsed time',()=>{let s=useBattleSkill(start(),'heavy');assert.equal(skillTurnsLeft(s.expedition!,'heavy'),6);assert.strictEqual(tick(s,999),s);for(let expected=5;expected>=0;expected--){s=resolveMonsterTurn(s);assert.equal(skillTurnsLeft(s.expedition!,'heavy'),expected);if(expected>0)s=basicAttack(s);}s=useBattleSkill(s,'heavy');assert.equal(skillTurnsLeft(s.expedition!,'heavy'),6);});
test('turn cooldown is independent of speed and survives save/load',()=>{let s=useBattleSkill(start(),'heavy');s=resolveMonsterTurn(s);assert.equal(skillTurnsLeft(s.expedition!,'heavy',999),5);const data=new Map<string,string>(),repo=createRepository({getItem:key=>data.get(key)??null,setItem:(key,value)=>void data.set(key,value)});repo.save(s);assert.equal(skillTurnsLeft(repo.load().expedition!,'heavy',.01),5);});
test('manual rounds advance only through explicit actions; compatibility tick is a no-op',()=>{let s=start();const unchanged=tick(s,10,()=>0);assert.strictEqual(unchanged,s);s=round(s);assert.equal(s.expedition!.playerTurn,2);assert.equal(s.expedition!.monsterTurn,1);});

