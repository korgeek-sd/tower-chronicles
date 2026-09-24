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

test('UI REBUILD 02: active mobile UI uses no decorative or legacy UI image assets',()=>{
 const active=[
  'src/main.tsx',
  'src/components/mobile/CoreScreens.tsx',
  'src/components/inventory/InventoryScreen.tsx',
  'src/components/inventory/InventoryDetailSheet.tsx',
  'src/components/workshop/WorkshopScreen.tsx',
  'src/components/enhancement/EnhancementScreen.tsx',
  'src/components/market/MarketScreen.tsx',
  'src/components/association/AssociationScreen.tsx',
  'src/components/events/EventScreen.tsx',
  'src/components/JobsScreen.tsx',
 ];
 for(const path of active){
  const source=read(path);
  assert.equal(source.includes('assets/ui'),false,path+' references a UI asset');
  assert.equal(source.includes('assets/backgrounds'),false,path+' references a background asset');
  assert.equal(source.includes('eventAsset('),false,path+' references an event-art asset');
 }
 const css=read('src/mobile-game.css');
 assert.equal(css.includes('url('),false,'mobile CSS must not load images');
});

test('UI REBUILD 03: the only active image tags belong to character or monster rendering',()=>{
 const battle=read('src/components/battle/BattleScene.tsx');
 const bestiary=read('src/components/bestiary/BestiaryScreen.tsx');
 const character=read('src/components/mobile/CharacterPreview.tsx');
 assert.match(battle,/playerGraphicFor/);
 assert.match(battle,/graphicFor/);
 assert.match(bestiary,/graphicFor/);
 assert.match(character,/playerGraphicFor/);
 assert.match(character,/<img/);
 assert.equal(character.includes('assets/ui'),false);
 assert.equal(character.includes('assets/backgrounds'),false);
 for(const path of ['src/main.tsx','src/components/mobile/CoreScreens.tsx','src/components/events/EventScreen.tsx','src/components/inventory/InventoryDetailSheet.tsx']){
  assert.equal(read(path).includes('<img'),false,path+' should not render image assets');
 }
});

test('UI REBUILD 04: the mobile shell prevents page scrolling and uses viewport-contained regions',()=>{
 const css=read('src/mobile-game.css');
 assert.match(css,/html,body,#root\{[^}]*overflow:hidden/);
 assert.match(css,/\.tc-app\{[^}]*height:100dvh/);
 assert.match(css,/\.tc-main\{[^}]*overflow:hidden/);
});
