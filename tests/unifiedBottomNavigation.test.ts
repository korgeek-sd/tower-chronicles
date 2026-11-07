import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HubIcon} from '../src/components/mobile/HubIcon';

const read=(p:string)=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const entry=read('main.tsx');
const dock=read('components/mobile/moonlit-camp.css');

test('five primary routes share the exact hub pixel atlas icons and keep their navigation actions',()=>{
 assert.match(entry,/const nav:\[AppPage,string\]\[\]/);
 assert.match(entry,/nav\.map\(\(\[p,label\]\)=>/);
 assert.match(entry,/<HubIcon name=\{p\}\/\>/);
 assert.doesNotMatch(entry,/page==='home'\|\|page==='association'\)\?<HubIcon/);
 for(const id of ['home','shop','inventory','market','association']){
  assert.ok(entry.includes("['"+id+"',"),'missing route '+id);
  const html=renderToStaticMarkup(React.createElement(HubIcon,{name:id}));
  assert.match(html,/tc-hub-icon/);
  assert.ok(html.includes('data-hub-icon="'+id+'"'));
 }
 assert.match(entry,/onClick=\{\(\)=>move\(p\)\}/);
 assert.ok(!entry.slice(entry.indexOf('const nav:'),entry.indexOf('function App(){')).includes("['hunt','전투']"));
 assert.match(entry,/\{page==='hunt'&&<HuntingPage/);
});

test('the hub dock styling applies to all screens and keeps the same selected indicator',()=>{
 assert.match(dock,/\.tc-app>\.tc-nav\{padding:2px 7px var\(--safe-b\)/);
 assert.match(dock,/\.tc-app>\.tc-nav button\[aria-current=true\]\{[^}]*inset 0 -2px #be9b56/s);
 assert.match(dock,/\.tc-app>\.tc-nav \.tc-hub-icon\{width:31px;height:31px\}/);
 assert.match(dock,/\.tc-app:has\(>\.tc-nav\)\{--nav:54px\}/);
 assert.match(dock,/\.tc-app>\.tc-nav button\[aria-current=true\]::after\{display:none\}/);
 assert.doesNotMatch(dock,/\.tc-app:has\(\.tc-moonlit-camp-screen\)>\.tc-nav/);
 const village=read('components/mobile/village-camp.css');
 const guild=read('components/association/gatehouse.css');
 assert.doesNotMatch(village,/\.tc-app:has\(\.tc-village-camp-screen\) \.tc-nav/);
 assert.doesNotMatch(guild,/\.tc-app:has\(\.tc-gate-identity\) > \.tc-nav/);
});
