import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve('.');
const manifest=JSON.parse(readFileSync(resolve(root,'public/assets/asset-manifest.json'),'utf8')) as Record<string,string[]>;

test('ASSETS 01: manifest paths are production files with safe ASCII slugs',()=>{
 const paths=Object.values(manifest).flat().filter((value):value is string=>typeof value==='string'&&value.startsWith('assets/'));
 assert.ok(paths.length>0);
 for(const path of paths){
  assert.match(path,/^assets\/[a-z0-9/_-]+\.(png|webp|svg)$/);
  assert.equal(existsSync(resolve(root,'public',path)),true,path);
 }
});

test('ASSETS 02: Iron Vein manifest covers five backgrounds, fifteen normal monsters, and five bosses',()=>{
 assert.equal(manifest.backgrounds.length,5);
 assert.equal(manifest.monsters.filter(path=>path.includes('iron-t1')).length,15);
 assert.equal(manifest.monsters.filter(path=>path.includes('iron-bosses')).length,5);
});

test('ASSETS 03: skill icons are present and use the battle-card mapping',()=>{
 const manifest=JSON.parse(readFileSync('public/assets/asset-manifest.json','utf8')) as {skills:string[]};
 assert.deepEqual(manifest.skills,[
  'assets/ui/inventory/skill-heavy.svg',
  'assets/ui/inventory/skill-execute.svg',
  'assets/ui/inventory/skill-guard.svg',
  'assets/ui/inventory/skill-quick.svg'
 ]);
 for(const path of manifest.skills)assert.ok(existsSync(`public/${path}`),path);
});

test('ASSETS 04: bottom navigation uses dedicated monochrome relic icons',()=>{
 assert.deepEqual(manifest.navigationRelic,[
  'assets/ui/navigation-relic/home.svg',
  'assets/ui/navigation-relic/inventory.svg',
  'assets/ui/navigation-relic/market.svg',
  'assets/ui/navigation-relic/association.svg',
  'assets/ui/navigation-relic/craft.svg',
  'assets/ui/navigation-relic/equipment.svg'
 ]);
 for(const path of manifest.navigationRelic)assert.ok(existsSync(resolve(root,'public',path)),path);
});

test('ASSETS 05: provided replacement navigation icons are mapped for matching tabs',()=>{
 assert.deepEqual(manifest.navigationNew,[
  'assets/ui/navigation-new/home.png',
  'assets/ui/navigation-new/inventory.png',
  'assets/ui/navigation-new/craft.png',
  'assets/ui/navigation-new/association.png',
  'assets/ui/navigation-new/equipment.png'
 ]);
 for(const path of manifest.navigationNew)assert.ok(existsSync(resolve(root,'public',path)),path);
});
