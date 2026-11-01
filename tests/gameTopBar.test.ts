import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {GameTopBar} from '../src/components/mobile/GameTopBar';

function renderBar(){
 const game=initialState();game.silver=10444660;game.market.gold=1250;
 const now=Date.now();game.goldenRecorder.expiresAt=now+4*86400000;
 return renderToStaticMarkup(React.createElement(GameTopBar,{
  nickname:'별명기록자',game,userId:null,lease:null,now,currentPage:'home',unreadMail:4,
  onProfile:()=>{},onShop:()=>{},onPremium:()=>{},onMail:()=>{},onMenu:()=>{}
 }));
}

test('compact HUD keeps real balances, premium term and accessible controls',()=>{
 const html=renderBar();
 for(const token of ['tc-topbar-compact','tc-tapestry-wallet','10,444,660','1,250',
  '프리미엄','4일 남음','우편함 열기','설정 메뉴 열기',
  '상점 열기 · 실버','상점 열기 · 골드','4개']){
  assert.ok(html.includes(token),token);
 }
 assert.doesNotMatch(html,/THE ARCHIVE OF THE TOWER|탑의 기록|별명기록자|tc-tapestry-brand|tc-tapestry-banner|tc-v2-xp|성장 현황|Lv\.78/);
 const start=html.indexOf('tc-tapestry-wallet');
 const premium=html.indexOf('tc-tapestry-premium');
 const tools=html.indexOf('tc-tapestry-tools');
 assert.ok(start>0&&premium>start&&tools>premium,'wallet must be first, premium middle, tools last');
});

test('topbar keeps existing navigation actions, removes the unused art dependency',()=>{
 const main=readFileSync('src/main.tsx','utf8');
 const code=readFileSync('src/components/mobile/GameTopBar.tsx','utf8');
 const css=readFileSync('src/components/mobile/game-topbar.css','utf8');
 assert.match(main,/<GameTopBar/);
 for(const token of ["onShop={()=>move('shop')}","onPremium={()=>setPremiumOpen(true)}",
  "onMail={()=>setMailOpen(true)}","onMenu={()=>move('settings')}"])
  assert.ok(main.includes(token),token);
 assert.match(code,/<PremiumStatus /);
 assert.match(code,/onClick=\{onShop\}/);
 assert.match(code,/onClick=\{onMail\}/);
 assert.match(code,/onClick=\{onMenu\}/);
 assert.doesNotMatch(code,/assetUrl\(|tc-tapestry-brand|tc-tapestry-banner/);
 assert.doesNotMatch(css,/background-image:var\(--tc-tapestry-sprite\)/);
 assert.doesNotMatch(code,/getCharacterGrowth\(|playerGraphicForJob\(|huntingProgress\(/);
});

test('premium concept 3 is a compact clickable card instead of a hanging banner',()=>{
 const css=readFileSync('src/components/mobile/game-topbar.css','utf8');
 const screen=readFileSync('src/components/mobile/GameTopBar.tsx','utf8');
 assert.match(css,/\.tc-app:has\(>\.tc-topbar-compact\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(103px,29vw,138px\)/);
 assert.match(css,/grid-template-columns:23px minmax\(0,1fr\) 10px/);
 assert.match(css,/\.tc-premium-status::before\{/);
 assert.match(css,/\.tc-premium-status::after\{/);
 assert.match(css,/border-radius:5px/);
 assert.match(css,/clip-path:none/);
 assert.doesNotMatch(css,/clip-path:polygon\(/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/@media\(max-width:340px\)/);
 assert.match(css,/\.tc-tapestry-unread/);
 assert.match(css,/focus-visible/);
 assert.match(screen,/onOpen=\{onPremium\}/);
 assert.doesNotMatch(css,/padding-top:\s*env\(safe-area-inset-top/);
});
