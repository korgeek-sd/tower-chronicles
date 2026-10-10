import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{readFileSync}from'node:fs';import{HomeScreen}from'../src/components/mobile/CoreScreens';import{initialState}from'../src/game/engine/state';
test('mail and settings are labeled camp facilities and mail keeps unread information',()=>{
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game:initialState(),onMove:()=>{},onOpenJobs:()=>{},onOpenMail:()=>{},mailUnread:3}));
 assert.match(html,/data-facility="mail"/);assert.match(html,/우편함/);assert.match(html,/미확인 우편 3개/);assert.match(html,/data-facility="settings"/);assert.match(html,/>설정</);
});
test('persistent header and immersive mail/settings entries are removed while dialog routing remains',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(main,/className="tc-header-actions"|className="tc-mail-open|className="tc-settings-open/);
 assert.match(main,/onOpenMail=\{\(\)=>setMailOpen\(true\)\}/);assert.match(main,/mailUnread=\{mailUnread\}/);assert.match(main,/page==='settings'.*<SettingsDialog/);
});
