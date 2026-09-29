import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENHANCEMENT_VFX_SPECS} from '../src/components/enhancement/enhancementVfxTimeline.ts';

const canvas=readFileSync(new URL('../src/components/enhancement/EnhancementVfxCanvas.tsx',import.meta.url),'utf8');
const feelCss=readFileSync(new URL('../src/gameFeel/game-feel.css',import.meta.url),'utf8');

test('SUCCESS VFX 0.1.85 01: success has a longer and denser reward budget',()=>{
 const spec=ENHANCEMENT_VFX_SPECS.SUCCESS;
 assert.ok(spec.duration>=1000);
 assert.ok(spec.particles>=34);
 assert.ok(spec.rings>=3);
 assert.ok(spec.shakePx>=2);
});

test('SUCCESS VFX 0.1.85 02: reward sequence layers beam seal rays glints and a distinct banner',()=>{
 for(const token of ['Forge-light pillar','rotating square/rune seal','Strong radial rays','four-point glints','ENHANCEMENT SUCCESS','강화 성공'])assert.ok(canvas.includes(token),token);
 assert.ok(canvas.includes('globalCompositeOperation'));
});

test('SUCCESS VFX 0.1.85 03: +10 success receives a max-enhancement celebration',()=>{
 assert.ok(canvas.includes('scene.target>=10'));
 assert.ok(canvas.includes('MAX ENHANCEMENT'));
 assert.ok(canvas.includes('최대 강화 달성'));
 assert.ok(canvas.includes('final crown arc'));
});

test('SUCCESS VFX 0.1.85 04: sigil receives a bounded local reward bounce with reduced-motion fallback',()=>{
 assert.match(feelCss,/tcForgeSigilReward/);
 assert.match(feelCss,/tc-enhance-feel-success \.tc-forge-sigil/);
 assert.match(feelCss,/prefers-reduced-motion/);
});
