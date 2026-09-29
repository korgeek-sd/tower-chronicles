import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {jobById} from '../src/game/jobs/catalog.ts';
import {playerGraphicForJob} from '../src/game/data/graphics.ts';

test('JOB ART 0.1.91 01: hunter has its dedicated right-facing character asset',()=>{
 const job=jobById('hunter');
 assert.equal(job?.displayName,'사냥꾼');
 assert.equal(job?.visualAssetKey,'assets/characters/jobs/hunter.webp');
 const path=fileURLToPath(new URL('../public/assets/characters/jobs/hunter.webp',import.meta.url));
 assert.equal(existsSync(path),true);
 assert.ok(statSync(path).size>5000);
});

test('JOB ART 0.1.91 02: hunter selection resolves to hunter art everywhere through shared graphics helper',()=>{
 assert.equal(playerGraphicForJob('hunter','default').image.idle,'assets/characters/jobs/hunter.webp');
 assert.equal(playerGraphicForJob('contract_mercenary','default').image.idle,'assets/characters/jobs/contract_mercenary.webp');
});
