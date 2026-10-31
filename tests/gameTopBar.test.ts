import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,statSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {GameTopBar} from '../src/components/mobile/GameTopBar';

test('ribbon status bar displays live currencies, premium period, and accessible controls',()=>{
 const game=initialState();game.silver=10444660;game.market.gold=1250;
 const now=Date.now();game.goldenRecorder.expiresAt=now+4*86400000;
 const html=renderToStaticMarkup(React.createElement(GameTopBar,{
  nickname:'별명기록자',game,userId:null,lease:null,now,currentPage:'home',unreadMail:4,
  onProfile:()=>{},onShop:()=>{},onPremium:()=>{},onMail:()=>{},onMenu:()=>{}
 }));
 for(const token of ['tc-topbar-tapestry','tc-tapestry-banner','탑의 기록','THE ARCHIVE OF THE TOWER',
  '10,444,660','1,250','프리미엄','4일 남음','우편함 열기','설정 메뉴 열기','상점 열기 · 실버','상점 열기 · 골드','4개']){
  assert.ok(html.includes(token),token);
 }
 assert.doesNotMatch(html,/별명기록자|tc-v2-portrait|tc-v2-xp|성장 현황|Lv\.78/);
});

test('topbar preserves action wiring and uses the approved pixel-art sprite',()=>{
 const main=readFileSync('src/main.tsx','utf8');
 const code=readFileSync('src/components/mobile/GameTopBar.tsx','utf8');
 const css=readFileSync('src/components/mobile/game-topbar.css','utf8');
 assert.match(main,/<GameTopBar/);
 for(const token of ["onShop={()=>move('shop')}","onPremium={()=>setPremiumOpen(true)}",
  "onMail={()=>setMailOpen(true)}","onMenu={()=>move('settings')}"])
  assert.ok(main.includes(token),token);
 assert.match(code,/assetUrl\('assets\/ui\/topbar\/tower-topbar-art\.webp'\)/);
 assert.match(code,/<PremiumStatus /);
 assert.match(code,/onClick=\{onShop\}/);
 assert.match(css,/background-image:var\(--tc-tapestry-sprite\)/);
 assert.ok(statSync('public/assets/ui/topbar/tower-topbar-art.webp').size>100);
 assert.doesNotMatch(code,/getCharacterGrowth\(|playerGraphicForJob\(|huntingProgress\(/);
});

test('concept 1 is compact, responsive and has an integrated premium banner',()=>{
 const screen=readFileSync('src/components/mobile/GameTopBar.tsx','utf8');
 const css=readFileSync('src/components/mobile/game-topbar.css','utf8');
 assert.match(screen,/tc-tapestry-premium/);
 assert.match(screen,/tc-tapestry-tools/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/@media\(max-width:340px\)/);
 assert.match(css,/clip-path:polygon\(/);
 assert.match(css,/\.tc-tapestry-unread/);
 assert.match(css,/focus-visible/);
 assert.doesNotMatch(css,/padding-top:\s*env\(safe-area-inset-top/);
});
