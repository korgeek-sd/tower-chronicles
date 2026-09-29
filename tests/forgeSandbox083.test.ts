import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/enhancement/EnhancementScreen.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('FORGE SANDBOX 01: empty accounts can load representative enhancement fixtures',()=>{
 assert.match(screen,/FORGE_SANDBOX_EQUIPMENT/);
 for(const level of ['enhancement:0','enhancement:4','enhancement:7','enhancement:9','enhancement:10'])assert.ok(screen.includes(level),level);
 assert.match(screen,/5_000_000/);
 assert.match(screen,/enhancement_stone:500/);
 assert.match(screen,/테스트 장비로 체험/);
});

test('FORGE SANDBOX 02: sandbox is component-local and never writes the player save',()=>{
 assert.ok(screen.includes('const [sandboxGame,setSandboxGame]=useState<GameState|null>(null)'));
 assert.ok(screen.includes('const activeGame=sandboxGame??game'));
 assert.ok(screen.includes('if(sandboxGame){'));
 assert.ok(screen.includes('setSandboxGame(current=>'));
 const start=screen.slice(screen.indexOf('const startForgeSandbox'),screen.indexOf('const stopForgeSandbox'));
 assert.doesNotMatch(start,/setGame(/);
 assert.match(screen,/체험 모드/);
 assert.match(screen,/체험 종료/);
});

test('FORGE SANDBOX 03: sandbox never calls the live market or online enhancement path',()=>{
 assert.match(screen,/const marketId=!sandboxGame&&selected/);
 assert.match(screen,/체험 중 거래 제외/);
 const sandboxBranch=screen.slice(screen.indexOf('if(sandboxGame){'),screen.indexOf('if(!onlineLease){'));
 assert.doesNotMatch(sandboxBranch,/enhanceOnlineEquipment/);
});

test('FORGE SANDBOX 04: sandbox entry remains touch-safe on narrow phones',()=>{
 const section=css.slice(css.indexOf('/* v0.1.83 QA patch — forge sandbox equipment'));
 assert.match(section,/min-height:44px/);
 assert.match(section,/@media(max-width:380px)/);
 assert.equal(/urls*(/i.test(section),false);
});
