import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {jobById} from '../src/game/jobs/catalog.ts';
import {playerGraphicForJob} from '../src/game/data/graphics.ts';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('JOB ART 0.1.90 01: contract mercenary owns the first real job visual asset',()=>{
 const job=jobById('contract_mercenary');
 assert.equal(job?.visualAssetKey,'assets/characters/jobs/contract_mercenary.webp');
 assert.equal(jobById('hunter')?.visualAssetKey,'assets/characters/jobs/hunter.webp');
 assert.equal(jobById('reclaimer')?.visualAssetKey,'assets/characters/jobs/reclaimer.webp');
 const paths=['contract_mercenary','hunter','reclaimer'].map(id=>fileURLToPath(new URL('../public/assets/characters/jobs/'+id+'.webp',import.meta.url)));
 for(const path of paths){assert.equal(existsSync(path),true,path);assert.ok(statSync(path).size>5000,path);}
});

test('JOB ART 0.1.90 02: job art overrides cosmetics only when a visual exists',()=>{
 assert.equal(playerGraphicForJob('contract_mercenary','default').image.idle,'assets/characters/jobs/contract_mercenary.webp');
 assert.equal(playerGraphicForJob('hunter','default').image.idle,'assets/characters/jobs/hunter.webp');
 assert.equal(playerGraphicForJob('reclaimer','default').image.idle,'assets/characters/jobs/reclaimer.webp');
 assert.equal(playerGraphicForJob(null,'default').image.idle,'assets/player/default.png');
});

test('JOB ART 0.1.90 03: battle uses expedition job snapshot and inventory uses selected job',()=>{
 const battle=read('src/components/battle/BattleScene.tsx');
 const inventory=read('src/components/inventory/InventoryScreen.tsx');
 assert.match(battle,/playerGraphicForJob\(jobId,appearanceId\)/);
 assert.match(battle,/jobId=\{expedition\.jobSnapshotId\}/);
 assert.match(inventory,/playerGraphicForJob\(activeGame\.expedition\?\.jobSnapshotId\?\?activeGame\.currentJobId/);
});

test('JOB ART 0.1.90 04: job list, registration result and camp dossier expose the asset',()=>{
 const jobs=read('src/components/JobsScreen.tsx');
 const home=read('src/components/mobile/CoreScreens.tsx');
 assert.match(jobs,/tc-job-art/);
 assert.match(jobs,/tc-reg-job-art/);
 assert.match(jobs,/tc-reg-mini-job-art/);
 assert.match(home,/tc-camp-crest.*has-job-art/);
 assert.match(home,/assetUrl\(job\.visualAssetKey\)/);
});

test('JOB ART 0.1.90 05: job art CSS stays pixelated and contains no external URL',()=>{
 const css=read('src/mobile-game.css');
 const section=css.slice(css.indexOf('/* v0.1.90 — CONTRACT MERCENARY JOB CHARACTER ASSET'));
 assert.match(section,/image-rendering:pixelated/);
 assert.equal(/url\s*\(/i.test(section),false);
});
