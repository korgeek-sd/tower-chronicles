import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const scene=readFileSync(new URL('../src/components/battle/BattleScene.tsx',import.meta.url),'utf8');
const canvas=readFileSync(new URL('../src/components/battle/BattleVfxCanvas.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('BATTLE HIT 0.1.87 01: every structured HP damage event retriggers target shake and particles',()=>{
 assert.match(scene,/for\(const event of direct\)/);
 assert.match(scene,/if\(event\.hpDamage>0\)shakeTarget\(event\.target,event\.critical\)/);
 assert.match(scene,/vfxRef\.current\?\.playEvent\(event,speed\)/);
 assert.match(scene,/hitAnimations\.current\[target\]\?\.cancel\(\)/);
 assert.match(scene,/figure\.animate/);
 assert.match(canvas,/if\(event\.hpDamage>0\)/);
 assert.match(canvas,/push\(kind,from,to,speed,seed\+23\)/);
});

test('BATTLE HIT 0.1.87 02: multi-hit attacks stagger each hit instead of collapsing into one flash',()=>{
 assert.match(scene,/hitGap=Math\.round\(78\/rate\)/);
 assert.match(scene,/event\.hitCount>1\?Math\.max\(0,event\.hitIndex-1\)\*hitGap:0/);
 assert.match(scene,/addFloating\(/);
});

test('BATTLE HIT 0.1.87 03: damage numbers are attached to the damaged actor and split into animated digits',()=>{
 assert.match(scene,/target:'player'\|'monster'/);
 assert.match(scene,/target-\'\+e\.target/);
 assert.match(scene,/tc-damage-digits/);
 assert.match(scene,/tc-damage-digit/);
 assert.match(scene,/String\(Math\.max\(0,Math\.ceil\(amount\)\)\)\.split\(''\)/);
});

test('BATTLE HIT 0.1.87 04: monster and player damage pops sit above their character positions',()=>{
 const section=css.slice(css.indexOf('/* v0.1.87 — TARGET HIT REACTION + MAPLE-LIKE DAMAGE POPS'));
 assert.match(section,/\.floating-number\.target-monster[\s\S]*left:calc\(72%/);
 assert.match(section,/\.floating-number\.target-player[\s\S]*left:calc\(22%/);
 assert.match(section,/tcDamageDigitPop/);
 assert.match(section,/Impact,Haettenschweiler/);
 assert.equal(/url\s*\(/i.test(section),false);
});

test('BATTLE HIT 0.1.87 05: fallback damage also triggers target particles and shake',()=>{
 assert.match(canvas,/playDamage:\(target:'player'\|'monster'/);
 assert.match(scene,/playDamage\('monster',false,speed\)/);
 assert.match(scene,/playDamage\('player',false,speed\)/);
});
