import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BATTLE_VFX_SPECS,battleVisualRate} from '../src/components/battle/battleVfxTimeline.ts';

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const canvas=read('src/components/battle/BattleVfxCanvas.tsx');
const scene=read('src/components/battle/BattleScene.tsx');
const screen=read('src/components/battle/BattleScreen.tsx');
const recipe=read('src/gameFeel/recipes/combat.ts');
const css=read('src/mobile-game.css');

test('BATTLE VFX 0.1.86 01: canvas owns bounded combat effects and stops RAF when idle',()=>{
 assert.match(canvas,/<canvas/);
 assert.match(canvas,/requestAnimationFrame/);
 assert.match(canvas,/effectsRef\.current=\[\.\.\.effectsRef\.current,effect\]\.slice\(-10\)/);
 assert.match(canvas,/Math\.min\(2,window\.devicePixelRatio/);
 assert.match(canvas,/if\(survivors\.length\)frameRef\.current=requestAnimationFrame/);
});

test('BATTLE VFX 0.1.86 02: ordinary, critical, damage, guard, heal and death have distinct budgets',()=>{
 assert.ok(BATTLE_VFX_SPECS['critical-hit'].particles>BATTLE_VFX_SPECS['basic-hit'].particles);
 assert.ok(BATTLE_VFX_SPECS['critical-hit'].holdMs>BATTLE_VFX_SPECS['basic-hit'].holdMs);
 assert.ok(BATTLE_VFX_SPECS.death.shakePx>BATTLE_VFX_SPECS['player-damaged'].shakePx);
 assert.ok(BATTLE_VFX_SPECS.guard.particles>0);
 assert.ok(BATTLE_VFX_SPECS.heal.particles>0);
 assert.equal(battleVisualRate(3),2);
});

test('BATTLE VFX 0.1.86 03: authoritative combat events drive visual hits without changing combat outcomes',()=>{
 assert.match(scene,/vfxRef\.current\?\.playEvent\(event,speed\)/);
 assert.match(scene,/event\.absorbedByShield>0/);
 assert.match(scene,/event\.hpDamage>0/);
 assert.match(scene,/expedition\.hp<=0&&before\.hp>0/);
 assert.doesNotMatch(canvas,/setGame|basicAttack|resolveMonsterTurn/);
});

test('BATTLE VFX 0.1.86 04: skill anticipation starts before the existing action callback and does not delay it',()=>{
 assert.match(screen,/cuePlayerAction/);
 assert.match(screen,/setActionCue\(\{id:\+\+actionCueSeq\.current,kind\}\);action\(\)/);
 assert.doesNotMatch(screen,/cuePlayerAction\('basic',onBasicAttack\)/);
 assert.match(screen,/cuePlayerAction\('skill',\(\)=>onSkill\(skill\.id\)\)/);
 assert.match(scene,/cuePlayerAction\(actionCue\.kind,speed\)/);
});

test('BATTLE VFX 0.1.86 05: shared game feel keeps haptics while dedicated scene owns battle visuals',()=>{
 assert.match(recipe,/kind:'haptic'/);
 assert.doesNotMatch(recipe,/kind:'shake'/);
 assert.doesNotMatch(recipe,/kind:'pulse'/);
 assert.doesNotMatch(recipe,/kind:'flash'/);
});

test('BATTLE VFX 0.1.86 06: mobile layer is overlay-only and reduced-motion safe',()=>{
 const section=css.slice(css.indexOf('/* v0.1.86 — BATTLE CANVAS VFX'));
 assert.match(section,/pointer-events:none/);
 assert.match(section,/prefers-reduced-motion:reduce/);
 assert.equal(/url\s*\(/i.test(section),false);
});
