import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{readFileSync}from'node:fs';import{HomeScreen}from'../src/components/mobile/CoreScreens';import{initialState}from'../src/game/engine/state';
test('quests replace the map mailbox and settings remain available',()=>{
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game:initialState(),onMove:()=>{},onOpenJobs:()=>{},onOpenMail:()=>{},mailUnread:3}));
 assert.match(html,/data-facility="quests"/);assert.match(html,/의뢰 게시판/);const core=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 assert.match(core,/id:'settings',glyph:'settings',name:'설정',action:\(\)=>onMove\('settings'\)/);
 assert.match(html,/전체 시설/);
});
test('header opens mail with its unread count and settings keeps dialog routing',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(main,/className="tc-header-actions"|className="tc-mail-open|className="tc-settings-open/);
 assert.match(main,/onMail=\{\(\)=>setMailOpen\(true\)\}/);assert.match(main,/unreadMail=\{mailUnread\}/);assert.match(main,/page==='settings'.*<SettingsDialog/);
});
