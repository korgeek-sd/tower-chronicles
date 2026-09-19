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
  assert.match(path,/^assets\/[a-z0-9/_-]+\.(png|webp)$/);
  assert.equal(existsSync(resolve(root,'public',path)),true,path);
 }
});

test('ASSETS 02: Iron Vein manifest covers five backgrounds, five normal monsters, and five bosses',()=>{
 assert.equal(manifest.backgrounds.length,5);
 assert.equal(manifest.monsters.filter(path=>path.includes('iron-t1')).length,5);
 assert.equal(manifest.monsters.filter(path=>path.includes('iron-bosses')).length,5);
});
