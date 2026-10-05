import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/battle/BattleScreen.tsx',import.meta.url),'utf8');

test('battle action bar is fixed to three skills, potion, and return',()=>{
 assert.match(screen,/const skillSlots=Array\.from\(\{length:3\}/);
 assert.match(screen,/const skillCards=skillSlots\.map/);
 const actions=screen.match(/<div className="tc-ref-actions">([\s\S]*?)<\/div>\n\n  <div className="tc-ref-turn">/)?.[1]??'';
 assert.ok(actions,'tc-ref-actions block should exist');
 assert.doesNotMatch(actions,/기본 공격/);
 assert.match(actions,/\{skillCards\}[\s\S]*?<strong>포션<\/strong>[\s\S]*?<strong>귀환<\/strong>/);
 assert.match(actions,/onClick=\{onFlee\}/);
});

test('return action lives inside the five-card row instead of a separate flee button',()=>{
 assert.doesNotMatch(screen,/className="tc-ref-flee/);
});
