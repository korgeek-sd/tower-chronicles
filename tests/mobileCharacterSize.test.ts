import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('mobile player has a larger footprint and stays above the action deck',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 const rules=[...css.matchAll(/\.tc-battle-reference \.player-placement\{([^}]+)\}/g)].map(m=>m[1]);
 assert.equal(rules.length,2);
 for(const rule of rules){
  const height=Number(rule.match(/height:(\d+)%/)?.[1]);
  const top=Number(rule.match(/top:(\d+)%/)?.[1]);
  assert.ok(height>=38,'player must occupy at least 38% of battle height');
  assert.ok(top+height/2<=79,'player must end above the action deck');
 }
 assert.match(rules[0],/width:62%/);
});
