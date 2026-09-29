import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENHANCEMENT_ATTEMPT_MIN_MS,ENHANCEMENT_VFX_SPECS} from '../src/components/enhancement/enhancementVfxTimeline.ts';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const canvas=read('src/components/enhancement/EnhancementVfxCanvas.tsx');
const screen=read('src/components/enhancement/EnhancementScreen.tsx');
const recipe=read('src/gameFeel/recipes/enhancement.ts');
const css=read('src/mobile-game.css');

test('ENHANCEMENT VFX 0.1.84 01: canvas renderer owns a bounded requestAnimationFrame timeline',()=>{
 assert.match(canvas,/<canvas/);
 assert.match(canvas,/requestAnimationFrame/);
 assert.match(canvas,/ResizeObserver/);
 assert.match(canvas,/Math\.min\(2,window\.devicePixelRatio/);
 assert.match(canvas,/prefers-reduced-motion: reduce/);
});

test('ENHANCEMENT VFX 0.1.84 02: four outcomes have distinct timing and particle budgets',()=>{
 assert.equal(ENHANCEMENT_ATTEMPT_MIN_MS,220);
 assert.ok(ENHANCEMENT_VFX_SPECS.SUCCESS.particles>ENHANCEMENT_VFX_SPECS.FAIL_KEEP.particles);
 assert.ok(ENHANCEMENT_VFX_SPECS.FAIL_DESTROY.shakePx>ENHANCEMENT_VFX_SPECS.FAIL_DOWNGRADE.shakePx);
 assert.ok(ENHANCEMENT_VFX_SPECS.FAIL_DESTROY.duration>ENHANCEMENT_VFX_SPECS.SUCCESS.duration);
 for(const outcome of ['SUCCESS','FAIL_KEEP','FAIL_DOWNGRADE'])assert.ok(canvas.includes("scene.outcome==='"+outcome+"'"),outcome);
 assert.ok(canvas.includes("'장비 파괴'"));
});

test('ENHANCEMENT VFX 0.1.84 03: anticipation resolves before local reveal while online request runs in parallel',()=>{
 assert.match(screen,/vfxRef\.current\?\.playAttempt/);
 assert.match(screen,/await waitForEnhancementAnticipation\(startedAt\)/);
 assert.match(screen,/Promise\.all\(\[request,waitForEnhancementAnticipation\(startedAt\)\]\)/);
 assert.match(screen,/vfxRef\.current\?\.playResult/);
 assert.match(screen,/setConfirm\(false\);\s*setBusy\(true\)/);
});

test('ENHANCEMENT VFX 0.1.84 04: global feedback no longer duplicates full-screen enhancement visuals',()=>{
 assert.doesNotMatch(recipe,/kind:'flash'/);
 assert.doesNotMatch(recipe,/kind:'particles'/);
 assert.doesNotMatch(recipe,/kind:'shake'/);
 assert.match(recipe,/kind:'haptic'/);
});

test('ENHANCEMENT VFX 0.1.84 05: canvas is overlay-only with no external visual asset dependency',()=>{
 const section=css.slice(css.indexOf('/* v0.1.84 — ENHANCEMENT CANVAS VFX'));
 assert.match(section,/pointer-events:none/);
 assert.match(section,/z-index:20/);
 assert.equal(/url\s*\(/i.test(section),false);
});
