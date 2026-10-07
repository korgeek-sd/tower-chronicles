import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {enter} from '../src/game/engine/expedition';
import {createMonsterRuntime} from '../src/game/engine/monsterAi';
import {monsterIntentView} from '../src/components/battle/combatIntel';
import {MonsterIntentBanner} from '../src/components/battle/MonsterIntentBanner';
test('confirmed iron charge warns when it fires and how to respond',()=>{
 const e=enter(initialState(),'ore',1).expedition!;e.monster.definitionId='iron_maw_burrower';e.monsterRuntime=createMonsterRuntime(e.monster);e.monsterRuntime.preparedActionId='burrow_charge';
 const html=renderToStaticMarkup(React.createElement(MonsterIntentBanner,{intent:monsterIntentView(e)}));
 assert.match(html,/굴진 돌격/);assert.match(html,/다음 적 턴에 발동/);assert.match(html,/205%/);assert.match(html,/기절/);assert.match(html,/보호막/);assert.match(html,/role="alert"/);
});
test('unprepared monster never shows a predicted attack warning',()=>{
 const e=enter(initialState(),'ore',1).expedition!;
 assert.equal(renderToStaticMarkup(React.createElement(MonsterIntentBanner,{intent:monsterIntentView(e)})),'');
});
