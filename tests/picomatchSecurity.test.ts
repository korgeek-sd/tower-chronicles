import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {realpathSync,readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
test('the Vite build dependency resolves to the locally patched MIT source',()=>{
 const root=JSON.parse(readFileSync('package.json','utf8'));
 assert.equal(root.overrides.picomatch,'$picomatch');
 for(const from of ['vite','fdir','tinyglobby']){
  const depRequire=createRequire(require.resolve(from));
  assert.equal(realpathSync(depRequire.resolve('picomatch')),realpathSync('vendor/picomatch-patched/index.js'));
 }
 const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
 assert.equal(lock.packages['node_modules/picomatch'].link,true);
 assert.equal(lock.packages['vendor/picomatch-patched'].dev,true);
});
test('CVE-2026-112366 single-branch repeated extglobs fail closed without blocking the build',()=>{
 const check=spawnSync(process.execPath,['-e',`
  const assert=require('node:assert/strict'),pm=require('picomatch');
  assert.equal(pm('**/*.ts')('src/example.ts'),true);
  assert.equal(pm('**/*.{ts,tsx}')('src/example.tsx'),true);
  assert.equal(pm('+(ab)')('abab'),true);
  for(const opts of [{},{maxExtglobRecursion:false}]){
   for(const pattern of ['+(*)','+(*a)','*(*a)','+(*?)']){
    const matcher=pm(pattern,opts);
    assert.equal(matcher('a'.repeat(5000)+'!'),false);
    assert.equal(matcher(pattern),true);
   }
  }
 `],{encoding:'utf8',timeout:3000});
 assert.ifError(check.error);
 assert.equal(check.status,0,check.stderr);
});
