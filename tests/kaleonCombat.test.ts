import test from 'node:test';
import assert from 'node:assert/strict';
import type {ActiveEffect,Monster} from '../src/game/types.ts';
import {validateEffectDefinitions} from '../src/game/engine/effects.ts';
import {chooseMonsterAction,createMonsterRuntime,monsterDefinitionById,validateMonsterDefinition} from '../src/game/engine/monsterAi.ts';
import {KALEON_BOSS_DEFINITIONS,KALEON_MONSTER_DEFINITIONS,KALEON_NORMAL_DEFINITIONS} from '../src/game/engine/kaleonMonsters.ts';

const effect=(effectId:string,stackCount=1,target:'player'|'monster'='player'):ActiveEffect=>({instanceId:'test-'+effectId,effectId,sourceActorId:'monster',targetActorId:target,remainingDuration:5,stackCount,applicationSequence:1,createdTurn:0,scope:'BATTLE'});
const makeMonster=(id:string,currentHp=100):Monster=>{const definition=monsterDefinitionById(id);assert.ok(definition);return {definitionId:id,name:definition.name,hp:100,currentHp,attack:10,defense:2,speed:1,skillPower:1};};
function pick(id:string,options:{currentHp?:number;targetHp?:number;selfEffects?:ActiveEffect[];targetEffects?:ActiveEffect[]}={}){const monster=makeMonster(id,options.currentHp??100),definition=monsterDefinitionById(id)!;return chooseMonsterAction(definition,createMonsterRuntime(monster),monster,options.targetHp??100,100,options.selfEffects??[],options.targetEffects??[]).skill?.id;}

test('KALEON COMBAT 01: 5 normal + 5 boss definitions and all referenced effects validate',()=>{
 assert.equal(KALEON_NORMAL_DEFINITIONS.length,5);
 assert.equal(KALEON_BOSS_DEFINITIONS.length,5);
 assert.equal(KALEON_MONSTER_DEFINITIONS.length,10);
 for(const definition of KALEON_MONSTER_DEFINITIONS){assert.equal(monsterDefinitionById(definition.id),definition);assert.deepEqual(validateMonsterDefinition(definition),[]);}
 assert.deepEqual(validateEffectDefinitions(),[]);
});

test('KALEON COMBAT 02: normal monsters open with distinct role-defining actions',()=>{
 assert.equal(pick('verdant_penitent'),'penitent_grace');
 assert.equal(pick('anointed_censer_bearer'),'censer_miasma');
 assert.equal(pick('vicarious_armor_monk'),'vicarious_guard');
 assert.equal(pick('confession_binder'),'confession_sentence');
 assert.equal(pick('stigmata_reaper'),'stigmata_cut');
 assert.equal(pick('stigmata_reaper',{targetHp:40,targetEffects:[effect('stigmata_wound')]}),'stigmata_harvest');
});

test('KALEON COMBAT 03: 6F healer transfers pain at full HP but prioritizes healing when wounded',()=>{
 assert.equal(pick('stigmata_healer'),'pain_transference');
 assert.equal(pick('stigmata_healer',{currentHp:60}),'stigmata_ministration');
 const transfer=monsterDefinitionById('stigmata_healer')!.skills!.find(skill=>skill.id==='pain_transference')!;
 assert.deepEqual(transfer.effects,[{target:'TARGET',effectId:'transferred_pain'},{target:'SELF',effectId:'verdant_grace'}]);
});

test('KALEON COMBAT 04: 7F cross bearer advances barrier → brand → charged crush',()=>{
 assert.equal(pick('atonement_cross_bearer'),'cross_barrier');
 assert.equal(pick('atonement_cross_bearer',{selfEffects:[effect('atonement_shield',1,'monster')]}),'atonement_brand');
 assert.equal(pick('atonement_cross_bearer',{selfEffects:[effect('atonement_shield',1,'monster')],targetEffects:[effect('atonement_mark')]}),'cross_crush');
});

test('KALEON COMBAT 05: 8F executioner requires three sacrifice marks before execution',()=>{
 assert.equal(pick('sacrament_executioner',{targetEffects:[effect('sacrifice_mark',2)]}),'sacrifice_sentence');
 assert.equal(pick('sacrament_executioner',{targetEffects:[effect('sacrifice_mark',3)]}),'sacrament_execution');
});

test('KALEON COMBAT 06: 9F apostle layers false grace, inverted absolution, then reactive judgment',()=>{
 assert.equal(pick('false_salvation_apostle'),'false_grace');
 const shield=[effect('false_grace_shield',1,'monster')];
 assert.equal(pick('false_salvation_apostle',{selfEffects:shield}),'inverted_absolution');
 assert.equal(pick('false_salvation_apostle',{selfEffects:shield,targetEffects:[effect('confession_burden'),effect('stigmata_wound')]}),'apostle_counter_stance');
});

test('KALEON COMBAT 07: Kaleon builds atonement debt, executes at three stacks, and low HP gospel overrides all',()=>{
 assert.equal(pick('kaleon_green_messiah'),'kaleon_false_salvation');
 const self=[effect('kaleon_shield',1,'monster')],burden=[effect('confession_burden'),effect('stigmata_wound')];
 assert.equal(pick('kaleon_green_messiah',{selfEffects:self,targetEffects:burden}),'kaleon_transfer');
 assert.equal(pick('kaleon_green_messiah',{selfEffects:self,targetEffects:[...burden,effect('atonement_debt',3)]}),'kaleon_execution');
 assert.equal(pick('kaleon_green_messiah',{currentHp:25,selfEffects:[...self,effect('kaleon_grace',1,'monster')],targetEffects:[...burden,effect('atonement_debt',3)]}),'kaleon_last_gospel');
});
