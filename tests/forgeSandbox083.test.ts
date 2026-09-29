import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/enhancement/EnhancementScreen.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('FORGE SANDBOX 01: empty accounts can load representative enhancement fixtures',()=>{
 assert.ok(screen.includes('FORGE_SANDBOX_EQUIPMENT'));
 for(const level of ['enhancement:0','enhancement:4','enhancement:7','enhancement:9','enhancement:10'])assert.ok(screen.includes(level),level);
 assert.ok(screen.includes('5_000_000'));
 assert.ok(screen.includes('enhancement_stone:500'));
 assert.ok(screen.includes('테스트 장비로 체험'));
});

test('FORGE SANDBOX 02: sandbox is component-local and never writes the player save',()=>{
 assert.ok(screen.includes('const [sandboxGame,setSandboxGame]=useState<GameState|null>(null)'));
 assert.match(screen,/activeGame=sandboxGame\?\?game/);
 assert.ok(screen.includes('if(sandboxGame){'));
 assert.match(screen,/setSandboxGame\(/);
 const start=screen.slice(screen.indexOf('const startForgeSandbox'),screen.indexOf('const stopForgeSandbox'));
 assert.equal(start.includes('setGame('),false);
 assert.ok(screen.includes('체험 모드'));
 assert.ok(screen.includes('체험 종료'));
});

test('FORGE SANDBOX 03: sandbox never calls the live market or online enhancement path',()=>{
 assert.ok(screen.includes('const marketId=!sandboxGame&&selected'));
 assert.ok(screen.includes('체험 중 거래 제외'));
 const sandboxBranch=screen.slice(screen.indexOf('if(sandboxGame){'),screen.indexOf('if(!onlineLease){'));
 assert.equal(sandboxBranch.includes('enhanceOnlineEquipment'),false);
});

test('FORGE SANDBOX 04: sandbox entry remains touch-safe on narrow phones',()=>{
 const section=css.slice(css.indexOf('/* v0.1.83 QA patch — forge sandbox equipment'));
 assert.ok(section.includes('min-height:44px'));
 assert.ok(section.includes('@media(max-width:380px)'));
 assert.equal(section.includes('url('),false);
});
