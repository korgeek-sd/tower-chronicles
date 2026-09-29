import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {JOB_CATALOG} from '../src/game/jobs/catalog.ts';
import {JOB_VISUAL_ASSETS} from '../src/game/jobs/visualAssets.ts';
import {playerGraphicForJob} from '../src/game/data/graphics.ts';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('JOB ART FAST PATH 01: every registry entry is canonical, known, and backed by a real asset',()=>{
 const catalogIds=new Set(JOB_CATALOG.map(job=>job.id));
 for(const [id,path] of Object.entries(JOB_VISUAL_ASSETS)){
  assert.equal(catalogIds.has(id),true,'unknown job visual id: '+id);
  assert.equal(path,'assets/characters/jobs/'+id+'.webp','non-canonical visual path: '+id);
  const disk=fileURLToPath(new URL('../public/'+path,import.meta.url));
  assert.equal(existsSync(disk),true,disk);
  assert.ok(statSync(disk).size>5000,disk);
 }
});

test('JOB ART FAST PATH 02: catalog and graphic resolver consume the registry generically',()=>{
 for(const [id,path] of Object.entries(JOB_VISUAL_ASSETS)){
  const job=JOB_CATALOG.find(entry=>entry.id===id);
  assert.equal(job?.visualAssetKey,path,id);
  assert.equal(playerGraphicForJob(id,'default').image.idle,path,id);
 }
 assert.equal(playerGraphicForJob('nonexistent_job','default').image.idle,'assets/player/default.png');
});

test('JOB ART FAST PATH 03: active UI remains registry-driven rather than job-specific',()=>{
 const battle=read('src/components/battle/BattleScene.tsx');
 const jobs=read('src/components/JobsScreen.tsx');
 const home=read('src/components/mobile/CoreScreens.tsx');
 const inventory=read('src/components/inventory/InventoryScreen.tsx');
 assert.match(battle,/playerGraphicForJob\(jobId,appearanceId\)/);
 assert.match(jobs,/visualAssetKey/);
 assert.match(home,/job\?\.visualAssetKey/);
 assert.match(inventory,/playerGraphicForJob/);
 for(const id of Object.keys(JOB_VISUAL_ASSETS)){
  assert.equal(battle.includes(id),false,'battle must not hard-code '+id);
  assert.equal(jobs.includes(id),false,'jobs UI must not hard-code '+id);
  assert.equal(home.includes(id),false,'home UI must not hard-code '+id);
  assert.equal(inventory.includes(id),false,'inventory must not hard-code '+id);
 }
});

test('JOB ART FAST PATH 04: registry is isolated from release and save metadata',()=>{
 const registry=read('src/game/jobs/visualAssets.ts');
 assert.match(registry,/JOB_VISUAL_ASSETS/);
 assert.equal(registry.includes('APP_VERSION'),false);
 assert.equal(registry.includes('SAVE_SCHEMA'),false);
});
