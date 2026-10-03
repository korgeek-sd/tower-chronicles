import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/components/battle/BattleScreen.tsx',import.meta.url),'utf8');

test('battle hides redundant side controls while keeping the same tools in the battle menu',()=>{
 assert.doesNotMatch(source,/tc-ref-sidecontrols/);
 assert.doesNotMatch(source,/aria-label="적 전투 정보"/);
 assert.doesNotMatch(source,/aria-label="전투 속도"/);
 assert.match(source,/onClick=\{cycleSpeed\}>속도 ×\{prefs\.speed\}<\/button>/);
 assert.match(source,/onClick=\{\(\)=>setPanel\('enemy'\)\}>적 정보<\/button>/);
});
