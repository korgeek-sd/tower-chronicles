import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BATTLE_VFX_SPECS} from '../src/components/battle/battleVfxTimeline.ts';

const scene=readFileSync(new URL('../src/components/battle/BattleScene.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('BATTLE HIT FIX 0.1.88 01: damage pop position is measured from the real actor DOM box',()=>{
 assert.match(scene,/stageRef=useRef<HTMLDivElement\|null>/);
 assert.match(scene,/const damagePoint=/);
 assert.match(scene,/placement\.getBoundingClientRect\(\)/);
 assert.match(scene,/stage\.getBoundingClientRect\(\)/);
 assert.match(scene,/style=\{\{left:e\.x,top:e\.y/);
 assert.match(scene,/ref=\{stageRef\}/);
});

test('BATTLE HIT FIX 0.1.88 02: each HP hit restarts a visible actor-level shake',()=>{
 assert.match(scene,/hitAnimations\.current\[target\]\?\.cancel\(\)/);
 assert.match(scene,/amp=critical\?7:4/);
 assert.match(scene,/figure\.animate\(/);
 assert.match(scene,/brightness\(3\.5\)/);
 assert.match(scene,/if\(event\.hpDamage>0\)shakeTarget\(event\.target,event\.critical\)/);
});

test('BATTLE HIT FIX 0.1.88 03: ordinary and critical hits have visible particle budgets',()=>{
 assert.ok(BATTLE_VFX_SPECS['basic-hit'].particles>=14);
 assert.ok(BATTLE_VFX_SPECS['player-damaged'].particles>=16);
 assert.ok(BATTLE_VFX_SPECS['critical-hit'].particles>=28);
});

test('BATTLE HIT FIX 0.1.88 04: damage no longer uses a minus prefix and critical pop cannot fall back to old animation',()=>{
 assert.match(scene,/prefix=heal\?'\+':''/);
 const section=css.slice(css.indexOf('/* v0.1.88 — ACTOR-ANCHORED DAMAGE POP FIX'));
 assert.match(section,/target-monster\.critical/);
 assert.match(section,/animation:tcDamagePop[^;]+!important/);
 assert.equal(/url\s*\(/i.test(section),false);
});
