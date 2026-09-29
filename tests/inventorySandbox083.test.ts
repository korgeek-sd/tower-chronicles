import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/inventory/InventoryScreen.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('INVENTORY SANDBOX 01: empty inventory can preview all seven equipment slots',()=>{
 assert.ok(screen.includes('INVENTORY_SANDBOX_EQUIPMENT'));
 for(const id of ['inventory-sandbox-weapon','inventory-sandbox-helmet','inventory-sandbox-armor','inventory-sandbox-gloves','inventory-sandbox-boots','inventory-sandbox-necklace','inventory-sandbox-ring'])assert.ok(screen.includes(id),id);
 assert.ok(screen.includes('테스트 장비 채우기'));
 assert.ok(screen.includes("setCategory('equipment')"));
});

test('INVENTORY SANDBOX 02: sandbox equips seven fixtures and stays component-local',()=>{
 assert.ok(screen.includes('const [sandboxGame,setSandboxGame]=useState<GameState|null>(null)'));
 assert.ok(screen.includes('const activeGame=sandboxGame??game'));
 const start=screen.slice(screen.indexOf('const startInventorySandbox'),screen.indexOf('const stopInventorySandbox'));
 assert.equal(start.includes('setGame('),false);
 for(const slot of ['weapon','helmet','armor','gloves','boots','necklace','ring'])assert.ok(start.includes(slot+':'));
});

test('INVENTORY SANDBOX 03: sandbox blocks live trading and server dismantle',()=>{
 assert.ok(screen.includes("sandboxGame?'체험 중 거래 제외'"));
 assert.ok(screen.includes('if(sandboxGame){setSandboxGame'));
 assert.ok(screen.includes('marketItemId=!sandboxGame&&item'));
});

test('INVENTORY SANDBOX 04: narrow phone entry keeps a safe touch target',()=>{
 const section=css.slice(css.indexOf('/* v0.1.83 QA patch — inventory sandbox equipment'));
 assert.ok(section.includes('@media(max-width:380px)'));
 assert.ok(section.includes('min-height:44px'));
 assert.equal(section.includes('url('),false);
});
