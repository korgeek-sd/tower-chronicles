import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GameScrollSelect} from '../src/ui/GameScrollSelect';

const options=[
 {value:'g1',label:'일반 탐사대원 방진 장화',grade:'common' as const,gradeLabel:'일반',detail:'방어 +3'},
 {value:'g2',label:'영웅 기록원 제식 마도봉',grade:'heroic' as const,gradeLabel:'영웅',detail:'공격 +17'},
];
const preview=(value='',disabled=false)=>renderToStaticMarkup(
 React.createElement(GameScrollSelect,{options,value,onChange:()=>{},disabled,ariaLabel:'경매 등록 장비',placeholder:'장비를 선택하세요'})
);
test('equipment selector is rendered as a custom in-game button instead of Android native select',()=>{
 const markup=preview();
 assert.match(markup,/class="tc-game-select-trigger"/);
 assert.match(markup,/aria-haspopup="listbox"/);
 assert.match(markup,/aria-expanded="false"/);
 assert.match(markup,/장비를 선택하세요/);
 assert.doesNotMatch(markup,/<select|<option/);
});
test('picker preserves controlled selection and disabled submission state',()=>{
 const picked=preview('g2');
 assert.match(picked,/영웅 기록원 제식 마도봉/);
 assert.match(picked,/aria-expanded="false"/);
 const disabled=preview('g1',true);
 assert.match(disabled,/is-disabled/);
 assert.match(disabled,/disabled=""/);
 assert.match(disabled,/일반 탐사대원 방진 장화/);
});
test('picker source contains bounded touch-scroll list, clear search and Escape/outside close behavior',()=>{
 const code=readFileSync(new URL('../src/ui/GameScrollSelect.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/ui/game-scroll-select.css',import.meta.url),'utf8');
 assert.match(code,/tc-game-scroll-list/);
 assert.match(code,/role="listbox"/);
 assert.match(code,/role="option"/);
 assert.match(code,/aria-selected=\{value===option.value\}/);
 assert.match(code,/type="search"/);
 assert.match(code,/pointerdown/);
 assert.match(code,/Escape/);
 assert.match(code,/aria-label=\{ariaLabel\+' 검색'\}/);
 assert.match(css,/max-height:min\(32dvh,258px\)/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/overscroll-behavior-y:contain/);
 assert.match(css,/-webkit-overflow-scrolling:touch/);
 assert.match(css,/::-webkit-scrollbar-thumb/);
 assert.match(css,/button.tc-game-scroll-option.is-selected/);
});
test('guild auction register uses picker without changing server submission or replay logic',()=>{
 const code=readFileSync(new URL('../src/components/association/GuildAuctionPanel.tsx',import.meta.url),'utf8');
 assert.match(code,/import \{GameScrollSelect\}/);
 assert.match(code,/<GameScrollSelect/);
 assert.match(code,/value=\{selectedGear\} onChange=\{setSelectedGear\}/);
 assert.match(code,/disabled=\{busy\|\|!!pendingRegistration\}/);
 assert.match(code,/state.availableEquipment.map/);
 assert.match(code,/registerGuildAuctionItem\(lease,request.requestId,request.itemId,request.bid\)/);
 assert.match(code,/window.sessionStorage.setItem\(key,JSON.stringify\(request\)\)/);
 assert.doesNotMatch(code,/<select(?:\s|>)/);
 const css=readFileSync(new URL('../src/components/association/guildAuction.css',import.meta.url),'utf8');
 assert.match(css,/tc-ga-equip-field/);
});

test('game select adapter supports legacy options and numeric values without native select',()=>{
 const code=readFileSync(new URL('../src/ui/GameSelect.tsx',import.meta.url),'utf8');
 assert.match(code,/GameScrollSelect/);
 assert.match(code,/toOptions\(children\)/);
 assert.match(code,/onChange\?\.\(\{target:\{value:next\}\}\)/);
 const pages=['src/components/hunting/SkillSetupEditor.tsx','src/components/market/EquipmentMarketPanel.tsx','src/components/mobile/CoreScreens.tsx'];
 for(const path of pages){
  const text=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(text,/<GameSelect/);
  assert.doesNotMatch(text,/<select(?:\s|>)/);
 }
});
test('picker uses a visible custom drag rail and a viewport-clamped popup',()=>{
 const code=readFileSync(new URL('../src/ui/GameScrollSelect.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/ui/game-scroll-select.css',import.meta.url),'utf8');
 assert.match(code,/createPortal/);
 assert.match(code,/visualViewport/);
 assert.match(code,/closest\('dialog'\)/);
 assert.match(code,/tc-game-scroll-rail/);
 assert.match(css,/tc-game-scroll-thumb/);
});
