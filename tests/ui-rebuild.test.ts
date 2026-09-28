import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('UI REBUILD 01: runtime shell imports only the new mobile stylesheet',()=>{
 const main=read('src/main.tsx');
 assert.match(main,/import '\.\/mobile-game\.css';/);
 for(const legacy of ['./style.css','./pixel-ui.css','./ui-overhaul.css','./components/battle/immersive.css','./components/events/events.css']){
  assert.equal(main.includes("import '"+legacy+"'"),false,legacy+' must not be loaded by the rebuilt shell');
 }
});

test('UI REBUILD 02: approved UI images are routed through the central asset registry',()=>{
 const registry=read('src/ui/assets.ts'),main=read('src/main.tsx'),core=read('src/components/mobile/CoreScreens.tsx');
 assert.match(registry,/navigation-relic/);assert.match(registry,/shop\\/gold\\/gold_stack_/);
 assert.match(main,/navigationAssetFor/);assert.match(core,/shopGoldAssetFor/);
 assert.equal(main.includes('assets/ui/navigation-relic/'),false);assert.equal(core.includes('assets/shop/gold/'),false);
 const css=read('src/mobile-game.css');assert.equal(css.includes('url('),false,'mobile CSS must not load decorative backgrounds directly');
});

test('UI REBUILD 03: image tags are limited to authored game art and approved asset slots',()=>{
 const battle=read('src/components/battle/BattleScene.tsx'),bestiary=read('src/components/bestiary/BestiaryScreen.tsx');
 const main=read('src/main.tsx'),core=read('src/components/mobile/CoreScreens.tsx');
 assert.match(battle,/playerGraphicFor/);assert.match(battle,/graphicFor/);assert.match(bestiary,/graphicFor/);
 assert.match(main,/<img className="tc-nav-icon"/);assert.match(core,/<img className="tc-shop-art"/);
 for(const path of ['src/components/events/EventScreen.tsx','src/components/inventory/InventoryDetailSheet.tsx'])assert.equal(read(path).includes('<img'),false,path+' has no approved asset slot yet');
});

test('UI REBUILD 04: the mobile shell prevents page scrolling and uses viewport-contained regions',()=>{
 const css=read('src/mobile-game.css');
 assert.match(css,/html,body,#root\{[^}]*overflow:hidden/);
 assert.match(css,/\.tc-app\{[^}]*height:100dvh/);
 assert.match(css,/\.tc-main\{[^}]*overflow:hidden/);
});
