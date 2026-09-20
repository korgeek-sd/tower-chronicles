import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {EquipmentScreen} from '../src/components/equipment/EquipmentScreen';
import {SkillsScreen} from '../src/components/skills/SkillsScreen';

function stateWithActiveExpedition(){
  const game=initialState();
  game.expedition={
    events:{state:null,pending:null,history:[]},
    tower:'ore',floor:1,hp:180,
    monster:{name:'고블린 광부',hp:42,attack:11,defense:1,speed:.8,skillPower:1,currentHp:42},
    monsterRuntime:null,
    reactivePrepared:{player:null,monster:null},
    bag:{healing_lesser:10,healing_standard:0,healing_greater:0,healing_supreme:0,revival:0},
    time:0,playerTimer:0,enemyTimer:0,spawnAt:0,cooldowns:{},buffs:{},
    playerEffects:[],monsterEffects:[],preparedEffects:[],effectSequence:0,
    jobSnapshotId:null,jobRuntime:{jobId:null,passiveIds:[],activeSkillIds:[],resource:null},
    kills:0,
    loot:{silver:0,materials:{ore:[0,0,0,0,0],leather:[0,0,0,0,0],gem:[0,0,0,0,0],kaleon:[0,0,0,0,0]},tickets:{ore:Array(10).fill(0),leather:Array(10).fill(0),gem:Array(10).fill(0),kaleon:Array(10).fill(0)},skillBooks:{},items:{}},
    equipment:{...game.equipped},returnRequested:false,
    bossTracking:{progress:0,pendingBossId:null,encounterReason:null,bossDefeated:false},
    phase:'PLAYER_TURN',playerTurn:1,monsterTurn:0,pendingFlee:false,pendingRevival:null,
  };
  return game;
}

test('equipment screen is character-centered with four explicit gear slots',()=>{
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game:initialState(),setGame:()=>{},onSkills:()=>{},
  }));
  for(const label of ['무기','갑옷','신발','장신구'])assert.match(html,new RegExp(label));
  assert.equal((html.match(/equipment-slot-button/g)||[]).length,4);
  for(const stat of ['HP','공격','방어','공격속도'])assert.match(html,new RegExp(stat));
});

test('equipment replacement controls remain locked during an expedition',()=>{
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game:stateWithActiveExpedition(),setGame:()=>{},onSkills:()=>{},
  }));
  assert.match(html,/원정 잠금/);
  assert.match(html,/disabled/);
});

test('skills screen keeps three equipped priority slots and a paged catalog',()=>{
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game:initialState(),setGame:()=>{},onBack:()=>{},
  }));
  assert.equal((html.match(/class="skill-loadout-slot/g)||[]).length,3);
  assert.match(html,/class="skill-catalog"/);
  assert.match(html,/class="page-stepper"/);
  assert.match(html,/1 \/ 1/);
});

test('skill loadout controls remain locked during an expedition',()=>{
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game:stateWithActiveExpedition(),setGame:()=>{},onBack:()=>{},
  }));
  assert.match(html,/원정 중 변경 불가/);
  assert.ok((html.match(/disabled/g)||[]).length>=3);
});
