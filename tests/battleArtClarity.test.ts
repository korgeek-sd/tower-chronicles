import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playerGraphicForJob,playerGraphicFor} from '../src/game/data/graphics.ts';

test('battle cards keep artwork opaque and colored while disabled',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 const rule=css.match(/\.tc-ref-card:disabled\{([^}]+)\}/)?.[1]??'';
 assert.match(rule,/opacity:1(?:;|$)/);
 assert.match(rule,/filter:none(?:;|$)/);
});

test('restored field medic artwork resolves and unknown jobs retain the fallback',()=>{
 assert.equal(playerGraphicForJob('field_medic','default').image.idle,'assets/characters/jobs/field_medic.webp');
 assert.equal(playerGraphicForJob('unknown_job','default').image.idle,playerGraphicFor('default').image.idle);
});
