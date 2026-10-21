import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {START_NOTICES,getPublishedNotices,type StartNotice} from '../src/components/intro/startNotices';
import {StartNotices} from '../src/components/intro/StartNotices';
test('published notices are newest first and unpublished dates stay out of the list',()=>{
 const notice=(id:string,publishedAt:string,kind:'update'|'maintenance'='update'):StartNotice=>({id,publishedAt,kind,title:id,body:['내용']});
 const input=[notice('old','2026-10-19T00:00:00+09:00'),notice('future','2026-10-22T00:00:00+09:00'),notice('new','2026-10-21T00:00:00+09:00'),notice('invalid','bad'),notice('maintenance','2026-10-20T00:00:00+09:00','maintenance')];
 const now=Date.parse('2026-10-21T12:00:00+09:00');
 assert.deepEqual(getPublishedNotices(input,'all',now).map(n=>n.id),['new','maintenance','old']);
 assert.deepEqual(getPublishedNotices(input,'maintenance',now).map(n=>n.id),['maintenance']);
 assert.equal(input[0].id,'old');
});
test('initial announcements describe shipped changes without inventing scheduled maintenance',()=>{
 assert.equal(new Set(START_NOTICES.map(n=>n.id)).size,START_NOTICES.length);
 assert.ok(START_NOTICES.every(n=>n.title&&n.body.length));
 assert.equal(START_NOTICES.filter(n=>n.kind==='maintenance').length,0);
});
test('notice dialog exposes readable titles, dates, categories and native expandable content',()=>{
 const html=renderToStaticMarkup(React.createElement(StartNotices,{open:true,onClose:()=>{}}));
 assert.match(html,/<dialog/);assert.match(html,/공지사항 닫기/);assert.match(html,/업데이트/);assert.match(html,/점검/);assert.match(html,/<time/);assert.match(html,/<details/);assert.match(html,/<summary/);
});
test('notice entry is optional and native dialog retains Escape and focus behavior',()=>{
 const source=readFileSync(new URL('../src/components/intro/StartNotices.tsx',import.meta.url),'utf8');
 assert.match(source,/showModal\(\)/);assert.match(source,/onClose=\{onClose\}/);
 const start=readFileSync(new URL('../src/components/intro/StartScreen.tsx',import.meta.url),'utf8');
 assert.match(start,/useState\(false\)/);assert.match(start,/setNoticesOpen\(true\)/);assert.match(start,/aria-haspopup="dialog"/);
});
