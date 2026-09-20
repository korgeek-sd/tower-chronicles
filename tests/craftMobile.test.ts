import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {
  CraftScreen,
  craftRecipesFor,
  craftGradeState,
} from '../src/components/craft/CraftScreen';
import {CraftMasteryScreen} from '../src/components/craft/CraftMasteryScreen';

test('craft recipe catalog is field-specific and uses the locked recipe sets',()=>{
  assert.deepEqual(craftRecipesFor('weapon',1),['sword','dagger','bow','staff']);
  assert.deepEqual(craftRecipesFor('armor',1),['armor','boots']);
  assert.deepEqual(craftRecipesFor('accessory',1),['vampire','unyielding','berserker']);
  assert.deepEqual(craftRecipesFor('alchemy',1),['healing_lesser']);
  assert.deepEqual(craftRecipesFor('alchemy',5),[]);
});

test('craft grade state reports locked grade and material shortage without mutating game state',()=>{
  const game=initialState();
  const before=structuredClone(game);
  const locked=craftGradeState(game,'weapon',2,0);
  assert.equal(locked.locked,true);
  assert.equal(locked.canCraft,false);
  assert.equal(locked.materialName,'철광석');
  assert.deepEqual(game,before);
});

test('craft screen renders only the standard-height recipe page and uses grade wording',()=>{
  const game=initialState();
  game.materials.ore[0]=99;
  const html=renderToStaticMarkup(React.createElement(CraftScreen,{
    game,
    setGame:()=>{},
    now:0,
    onMastery:()=>{},
  }));
  assert.match(html,/제작 등급/);
  assert.match(html,/1등급/);
  assert.equal((html.match(/class="craft-recipe-card/g)||[]).length,3);
  assert.match(html,/1 \/ 2/);
  assert.equal((html.match(/제작 시작/g)||[]).length,1);
  assert.doesNotMatch(html,/transform:\s*scale/);
});

test('craft screen exposes expedition lock instead of allowing craft action',()=>{
  const game=initialState();
  game.expedition={} as typeof game.expedition;
  const html=renderToStaticMarkup(React.createElement(CraftScreen,{
    game,
    setGame:()=>{},
    now:0,
    onMastery:()=>{},
  }));
  assert.match(html,/원정 중 제작 불가/);
  assert.match(html,/disabled/);
});

test('craft mastery screen shows one field at a time with progress, crafts and discount',()=>{
  const game=initialState();
  game.mastery.weapon={unlocked:2,progress:3,crafts:7};
  const html=renderToStaticMarkup(React.createElement(CraftMasteryScreen,{
    game,
    onBack:()=>{},
  }));
  assert.match(html,/제작 숙련도/);
  assert.match(html,/무기 제작/);
  assert.match(html,/2등급 해금/);
  assert.match(html,/3 \/ 4/);
  assert.match(html,/총 제작<\/small><b>7회/);
  assert.match(html,/재료 절감<\/small><b>14%/);
  assert.equal((html.match(/craft-mastery-panel/g)||[]).length,1);
});
