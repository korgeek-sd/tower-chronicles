import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('ASSET PILOT 01: bottom navigation uses lightweight relic image assets for all five tabs',()=>{
 const main=read('src/main.tsx');
 for(const name of ['home','inventory','market','association','shop']){
  const path='public/assets/ui/navigation-relic/'+name+'.svg';
  assert.equal(existsSync(new URL('../'+path,import.meta.url)),true,path);
  assert.ok(statSync(new URL('../'+path,import.meta.url)).size<4096,path+' should stay lightweight');
 }
 assert.match(main,/navigationAssetFor/);
 assert.match(main,/className="tc-nav-icon"/);
 assert.match(main,/<img/);
});

test('ASSET PILOT 02: Gold shop cards use three reusable image tiers instead of CSS coin shapes',()=>{
 const screen=read('src/components/mobile/CoreScreens.tsx');
 for(const tier of [1,2,3]){
  const path='public/assets/shop/gold/gold_stack_'+tier+'.svg';
  assert.equal(existsSync(new URL('../'+path,import.meta.url)),true,path);
  assert.ok(statSync(new URL('../'+path,import.meta.url)).size<4096,path+' should stay lightweight');
 }
 assert.match(screen,/shopGoldAssetFor/);
 assert.match(screen,/tc-shop-art/);
 assert.doesNotMatch(screen,/tc-shop-mark/);
});

test('ASSET PILOT 03: asset registry owns UI paths and keeps component code free of duplicated path literals',()=>{
 const registry=read('src/ui/assets.ts');
 const main=read('src/main.tsx');
 const screen=read('src/components/mobile/CoreScreens.tsx');
 assert.match(registry,/navigation-relic/);
 assert.match(registry,/shop\/gold\/gold_stack_/);
 assert.equal(main.includes('assets/ui/navigation-relic/'),false);
 assert.equal(screen.includes('assets/shop/gold/'),false);
});

test('ASSET PILOT 04: asset images preserve viewport layout and native interaction feedback',()=>{
 const css=read('src/mobile-game.css');
 assert.match(css,/\.tc-nav-icon\{[^}]*object-fit:contain/s);
 assert.match(css,/\.tc-shop-art\{[^}]*object-fit:contain/s);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
