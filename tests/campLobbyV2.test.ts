import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HomeScreen} from '../src/components/mobile/CoreScreens';
import {WorldChat} from '../src/components/WorldChat';
import {initialState} from '../src/game/engine/state';

const campCss=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
const chatCss=readFileSync(new URL('../src/components/world-chat.css',import.meta.url),'utf8');
const chatSource=readFileSync(new URL('../src/components/WorldChat.tsx',import.meta.url),'utf8');
const appSource=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('Novar lobby v1 mockup becomes a real playable home with two primary actions and six facilities',()=>{
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game:initialState(),nickname:'시안 검사',onMove:()=>{},onOpenJobs:()=>{},onOpenMail:()=>{}}));
 for(const token of ['노바르 거점','시안 검사','HP','MP','활력','사냥하기','마을 이동','거점 시설','제작','스킬트리','스탯 분배','골드 거래소','점령전','우편함','전체 시설'])
  assert.ok(html.includes(token),token);
 const six=['craft','skills','stats','gold-exchange','occupation','mail'];
 for(const id of six)assert.match(html,new RegExp('data-facility="'+id+'"'));
 assert.match(html,/data-facility="hunt"/);
 assert.match(html,/data-facility="bestiary"/);
 assert.match(html,/id="tc-camp-chat-dock"/);
 assert.match(html,/class="tc-camp-v2-quick"/);
 assert.equal((html.match(/class="tc-feel-press" data-game-feel="press" data-facility=/g)??[]).length,6);
});
test('home and expanded chat share one WorldChat instance and existing Supabase send/subscription',()=>{
 assert.match(appSource,/inlineAtHome=\{page==='home'\}/);
 assert.equal((appSource.match(/<WorldChat /g)??[]).length,1);
 assert.match(chatSource,/import \{createPortal\} from 'react-dom'/);
 assert.match(chatSource,/createPortal\(<section className="tc-chat-inline"/);
 assert.match(chatSource,/subscribeChatMessages\(userId,/);
 assert.match(chatSource,/sendChatMessage\(body,request\.current\.id,associationId\)/);
 assert.match(chatSource,/aria-label="채팅 메시지"/);
 assert.match(chatSource,/aria-pressed=\{channel==='world'\}/);
 assert.match(chatSource,/onClick=\{\(\)=>setOpen\(true\)\}>확대/);
 assert.match(chatCss,/\.tc-chat-inline\{/);
 assert.match(chatCss,/\.tc-chat-inline-messages\{[^}]*overflow-y:auto/);
 assert.match(chatCss,/\.tc-chat-inline-form\{/);
 const inlineHtml=renderToStaticMarkup(React.createElement(WorldChat,{userId:null,enabled:false,inlineAtHome:true}));
 assert.doesNotMatch(inlineHtml,/tc-chat-entry/,'home should not show the old floating chat button over the chat dock');
});
test('lobby reserves a permanent, bounded chat area and mobile compact layout',()=>{
 assert.match(campCss,/\.tc-camp-v2\{[^}]*height:100%;[^}]*grid-template-rows:/);
 assert.match(campCss,/\.tc-camp-v2-chat-dock\{[^}]*height:100%;overflow:hidden/);
 assert.match(campCss,/@media\(max-height:740px\)/);
 assert.match(campCss,/@media\(max-height:590px\)/);
 assert.match(chatCss,/\.tc-chat-inline-messages\{[^}]*flex:1 1 0;min-height:0;overflow-y:auto/);
});
