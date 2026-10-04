import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const skillPath=new URL('../.agents/skills/importing-tower-skill-assets/SKILL.md',import.meta.url);
const agentsPath=new URL('../AGENTS.md',import.meta.url);

test('SKILL ASSET WORKFLOW 01: repository routes skill-image work to the dedicated skill',()=>{
 const agents=readFileSync(agentsPath,'utf8');
 assert.match(agents,/## Skill image assets/);
 assert.match(agents,/\.agents\/skills\/importing-tower-skill-assets\/SKILL\.md/);
});

test('SKILL ASSET WORKFLOW 02: dedicated skill defines the canonical visual asset contract',()=>{
 const skill=readFileSync(skillPath,'utf8');
 assert.match(skill,/name: importing-tower-skill-assets/);
 assert.match(skill,/description: Use when/i);
 assert.match(skill,/128×128|128x128/);
 assert.match(skill,/transparent WebP|투명 WebP/i);
 assert.match(skill,/public\/assets\/ui\/skills\/<job_id>\/<skill_id>\.webp/);
 assert.match(skill,/12px|16px/);
 assert.match(skill,/text|텍스트/i);
 assert.match(skill,/cooldown|쿨다운/i);
 assert.match(skill,/resource|자원/i);
});

test('SKILL ASSET WORKFLOW 03: pure asset imports preserve IDs and gameplay behavior',()=>{
 const skill=readFileSync(skillPath,'utf8');
 assert.match(skill,/skill\.id|skill ID/i);
 assert.match(skill,/do not rename|이름.*바꾸지|ID.*변경하지/i);
 assert.match(skill,/gameplay|전투 로직|balance|밸런스/i);
 assert.match(skill,/Glyph|fallback/i);
 assert.match(skill,/commit SHA|커밋 SHA/i);
});

test('SKILL ASSET WORKFLOW 04: first-time pipeline work is separated from pure image imports',()=>{
 const skill=readFileSync(skillPath,'utf8');
 assert.match(skill,/tower-game-ui/);
 assert.match(skill,/skillVisualAssets\.ts/);
 assert.match(skill,/regression test|회귀 테스트/i);
 assert.match(skill,/batch|일괄/i);
});
