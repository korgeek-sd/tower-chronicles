import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const skillPath=new URL('../.agents/skills/generating-tower-skill-art/SKILL.md',import.meta.url);
const agentsPath=new URL('../AGENTS.md',import.meta.url);

test('SKILL ART 01: repository routes skill-art creation to the dedicated generation skill',()=>{
 const agents=readFileSync(agentsPath,'utf8');
 assert.match(agents,/## Skill art generation/);
 assert.match(agents,/\.agents\/skills\/generating-tower-skill-art\/SKILL\.md/);
 assert.match(agents,/create|generate|만들|생성/i);
 assert.match(agents,/importing-tower-skill-assets/);
});

test('SKILL ART 02: generation skill defines the global Tower Chronicles icon style lock',()=>{
 const skill=readFileSync(skillPath,'utf8');
 assert.match(skill,/name: generating-tower-skill-art/);
 assert.match(skill,/description: Use when/i);
 assert.match(skill,/dark-fantasy|다크 판타지/i);
 assert.match(skill,/pixel/i);
 assert.match(skill,/transparent|투명/i);
 assert.match(skill,/70.?80%|70–80%|70-80%/);
 assert.match(skill,/text|텍스트/i);
 assert.match(skill,/frame|프레임/i);
 assert.match(skill,/25.?42px|25–42px|25-42px/);
});

test('SKILL ART 03: generation skill locks a shared visual language per job while keeping skills distinct',()=>{
 const skill=readFileSync(skillPath,'utf8');
 assert.match(skill,/Visual Lock/i);
 assert.match(skill,/palette|색조|색상/i);
 assert.match(skill,/light|광원/i);
 assert.match(skill,/material|재질/i);
 assert.match(skill,/pixel density|픽셀 밀도/i);
 assert.match(skill,/same job|같은 직업/i);
 assert.match(skill,/silhouette|실루엣/i);
 assert.match(skill,/distinguish|구분|다르게/i);
});

test('SKILL ART 04: generation intensity follows Generator Neutral Spender without baking runtime state into art',()=>{
 const skill=readFileSync(skillPath,'utf8');
 assert.match(skill,/Generator/);
 assert.match(skill,/Neutral/);
 assert.match(skill,/Spender/);
 assert.match(skill,/resource|자원/i);
 assert.match(skill,/cooldown|쿨다운/i);
 assert.match(skill,/do not|금지|넣지/i);
});

test('SKILL ART 05: completed generated art hands off to the established import pipeline',()=>{
 const skill=readFileSync(skillPath,'utf8');
 assert.match(skill,/importing-tower-skill-assets/);
 assert.match(skill,/128×128|128x128/);
 assert.match(skill,/WebP/);
 assert.match(skill,/skillVisualAssets\.ts|registry|레지스트리/i);
});
