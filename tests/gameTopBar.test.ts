import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {GameTopBar} from '../src/components/mobile/GameTopBar';

test('profile status bar uses live currencies and accessible actions',()=>{
 const game=initialState();game.silver=10444660;game.market.gold=1250;
 const html=renderToStaticMarkup(React.createElement(GameTopBar,{
  nickname:'별명기록자',game,userId:null,lease:null,now:Date.now(),currentPage:'home',unreadMail:4,
  onProfile:()=>{},onShop:()=>{},onPremium:()=>{},onMail:()=>{},onMenu:()=>{}
 }));
 for(const token of ['tc-topbar-profile-v2','별명기록자','10,444,660','1,250','프리미엄','우편함 열기','설정 메뉴 열기','골드 상점 열기','4개'])
  assert.ok(html.includes(token),token);
 assert.match(html,/성장 현황/);
 assert.match(html,/tc-v2-xp/);
 assert.doesNotMatch(html,/Lv\.78|58\.7%/);
});

test('topbar routes existing actions and uses actual server growth status',()=>{
 const main=readFileSync('src/main.tsx','utf8');
 const code=readFileSync('src/components/mobile/GameTopBar.tsx','utf8');
 const css=readFileSync('src/components/mobile/game-topbar.css','utf8');
 assert.match(main,/<GameTopBar/);
 for(const token of ["onProfile={()=>move('character')}","onShop={()=>move('shop')}","onPremium={()=>setPremiumOpen(true)}","onMail={()=>setMailOpen(true)}","onMenu={()=>move('settings')}"])
  assert.ok(main.includes(token),token);
 assert.match(code,/getCharacterGrowth\(lease\)/);
 assert.match(code,/huntingProgress\(data\.experience\)/);
 assert.match(code,/playerGraphicForJob\(/);
 assert.match(css,/max-width:390px/);
 assert.match(css,/max-width:350px/);
 assert.doesNotMatch(css,/padding-top:\s*env\(safe-area-inset-top/);
});
