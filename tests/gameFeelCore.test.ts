import test from 'node:test';
import assert from 'node:assert/strict';
import {
 GAME_FEEL_EVENTS,
 type GameFeelEvent,
} from '../src/gameFeel/types.ts';
import {resolveGameFeelRecipe} from '../src/gameFeel/engine.ts';

const expectedEvents:GameFeelEvent[]=[
 'ui.press','ui.confirm','ui.error',
 'seal.roll.start','seal.roll.result','seal.reset',
 'enhancement.attempt','enhancement.result',
 'combat.basic-hit','combat.critical-hit','combat.player-damaged','combat.guard','combat.heal','combat.death',
 'market.order-placed','market.order-cancelled','market.trade-partial','market.trade-filled',
];

test('GAME FEEL CORE 01: public semantic event catalog is stable',()=>{
 assert.deepEqual(GAME_FEEL_EVENTS,expectedEvents);
});

test('GAME FEEL CORE 02: seal result intensity follows authoritative step',()=>{
 assert.equal(resolveGameFeelRecipe('seal.roll.result',{step:1}).intensity,'normal');
 assert.equal(resolveGameFeelRecipe('seal.roll.result',{step:2}).intensity,'strong');
 assert.equal(resolveGameFeelRecipe('seal.roll.result',{step:3}).intensity,'exceptional');
});

test('GAME FEEL CORE 03: enhancement outcomes resolve to distinct presentation recipes',()=>{
 const success=resolveGameFeelRecipe('enhancement.result',{outcome:'SUCCESS'});
 const keep=resolveGameFeelRecipe('enhancement.result',{outcome:'FAIL_KEEP'});
 const down=resolveGameFeelRecipe('enhancement.result',{outcome:'FAIL_DOWNGRADE'});
 const destroyed=resolveGameFeelRecipe('enhancement.result',{outcome:'FAIL_DESTROYED'});
 assert.equal(success.intensity,'strong');
 assert.equal(keep.intensity,'subtle');
 assert.equal(down.intensity,'strong');
 assert.equal(destroyed.intensity,'exceptional');
 assert.notDeepEqual(success.commands,keep.commands);
 assert.notDeepEqual(down.commands,destroyed.commands);
});

test('GAME FEEL CORE 04: combat and market recipes are independent of gameplay state',()=>{
 assert.equal(resolveGameFeelRecipe('combat.basic-hit').event,'combat.basic-hit');
 assert.equal(resolveGameFeelRecipe('combat.critical-hit').intensity,'strong');
 assert.equal(resolveGameFeelRecipe('market.order-placed').intensity,'subtle');
 assert.equal(resolveGameFeelRecipe('market.trade-filled').intensity,'normal');
});

test('GAME FEEL CORE 05: reduced motion removes shake and particles but preserves visible feedback',()=>{
 const recipe=resolveGameFeelRecipe('seal.roll.result',{step:3},{reducedMotion:true});
 assert.equal(recipe.commands.some(command=>command.type==='shake'),false);
 assert.equal(recipe.commands.some(command=>command.type==='particles'),false);
 assert.equal(recipe.commands.some(command=>['flash','pulse','value-pop','burst'].includes(command.type)),true);
});

test('GAME FEEL CORE 06: malformed payloads degrade safely instead of throwing',()=>{
 assert.doesNotThrow(()=>resolveGameFeelRecipe('seal.roll.result',{step:99} as never));
 assert.equal(resolveGameFeelRecipe('seal.roll.result',{step:99} as never).intensity,'normal');
 assert.doesNotThrow(()=>resolveGameFeelRecipe('enhancement.result',{outcome:'WHAT'} as never));
 assert.equal(resolveGameFeelRecipe('enhancement.result',{outcome:'WHAT'} as never).intensity,'subtle');
});
