import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGameFeelRecipe} from '../src/gameFeel/engine.ts';

test('GAME FEEL CORE: seal results scale from normal to exceptional',()=>{
 assert.equal(resolveGameFeelRecipe('seal.roll.result',{step:1}).intensity,'normal');
 assert.equal(resolveGameFeelRecipe('seal.roll.result',{step:2}).intensity,'strong');
 assert.equal(resolveGameFeelRecipe('seal.roll.result',{step:3}).intensity,'exceptional');
});

test('GAME FEEL CORE: enhancement outcomes stay semantically distinct',()=>{
 const outcomes=['SUCCESS','FAIL_KEEP','FAIL_DOWNGRADE','FAIL_DESTROY'] as const;
 const recipes=outcomes.map(outcome=>resolveGameFeelRecipe('enhancement.result',{outcome}));
 assert.equal(new Set(recipes.map(recipe=>recipe.key)).size,4);
});

test('GAME FEEL CORE: reduced motion removes shake and particle travel but keeps visible result',()=>{
 const recipe=resolveGameFeelRecipe('seal.roll.result',{step:3},{reducedMotion:true});
 assert.equal(recipe.commands.some(command=>command.kind==='shake'),false);
 assert.equal(recipe.commands.some(command=>command.kind==='particles'),false);
 assert.equal(recipe.commands.some(command=>command.kind==='flash'||command.kind==='value-pop'||command.kind==='pulse'),true);
});

test('GAME FEEL CORE: unsafe payloads degrade without throwing',()=>{
 assert.doesNotThrow(()=>resolveGameFeelRecipe('seal.roll.result',{step:99} as never));
 assert.doesNotThrow(()=>resolveGameFeelRecipe('enhancement.result',{outcome:'UNKNOWN'} as never));
});

test('GAME FEEL CORE: market feedback stays restrained',()=>{
 for(const event of ['market.order-placed','market.order-cancelled','market.trade-partial','market.trade-filled'] as const){
  assert.ok(['subtle','normal'].includes(resolveGameFeelRecipe(event).intensity));
 }
});
