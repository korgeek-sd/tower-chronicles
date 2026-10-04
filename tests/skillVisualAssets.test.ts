import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const registryUrl=new URL('../src/game/jobs/skillVisualAssets.ts',import.meta.url);
const battleUrl=new URL('../src/components/battle/BattleScreen.tsx',import.meta.url);
const skillDocUrl=new URL('../.agents/skills/importing-tower-skill-assets/SKILL.md',import.meta.url);

test('SKILL VISUAL 01: generic skill visual registry exists with a null-safe resolver',()=>{
 assert.equal(existsSync(registryUrl),true,'src/game/jobs/skillVisualAssets.ts must exist');
 if(!existsSync(registryUrl))return;
 const source=readFileSync(registryUrl,'utf8');
 assert.match(source,/SKILL_VISUAL_ASSETS/);
 assert.match(source,/skillVisualAssetFor/);
 assert.match(source,/return .*\?\?null|return .*\?\? null/);
});

test('SKILL VISUAL 02: battle skill cards render registered art and preserve Glyph fallback',()=>{
 const source=readFileSync(battleUrl,'utf8');
 assert.match(source,/skillVisualAssetFor/);
 assert.match(source,/assetUrl/);
 assert.match(source,/<img[^>]+tc-skill-art/);
 assert.match(source,/objectFit:'contain'/);
 assert.match(source,/imageRendering:'pixelated'/);
 assert.match(source,/:<Glyph name=\{glyph\[id\]\?\?'skills'\}/);
 assert.match(source,/turns>0&&<b>\{turns\}<\/b>/);
});

test('SKILL VISUAL 03: import skill documents the established pipeline instead of first-time setup',()=>{
 const skill=readFileSync(skillDocUrl,'utf8');
 assert.match(skill,/pipeline is already established|파이프라인.*구축되어|파이프라인.*존재/i);
 assert.match(skill,/src\/game\/jobs\/skillVisualAssets\.ts/);
 assert.match(skill,/src\/components\/battle\/BattleScreen\.tsx/);
 assert.match(skill,/skillVisualAssetFor/);
 assert.match(skill,/tc-skill-art/);
 assert.doesNotMatch(skill,/If this generic pipeline does not exist yet/i);
});
