import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PageStepper} from '../src/components/mobile/PageStepper';
import {BottomNav} from '../src/components/mobile/BottomNav';
import {ScreenHeader} from '../src/components/mobile/ScreenHeader';
import {SegmentTabs} from '../src/components/mobile/SegmentTabs';

test('PageStepper exposes current page and disables boundaries',()=>{
  const html=renderToStaticMarkup(React.createElement(PageStepper,{
    page:0,pageCount:3,onPage:()=>{},
  }));
  assert.match(html,/1 \/ 3/);
  assert.match(html,/disabled/);
  assert.match(html,/다음/);
});

test('BottomNav marks the current destination',()=>{
  const html=renderToStaticMarkup(React.createElement(BottomNav,{
    current:'inventory',onNavigate:()=>{},
  }));
  assert.match(html,/aria-current="page"/);
  assert.match(html,/가방/);
  assert.equal((html.match(/<button/g)||[]).length,6);
});

test('ScreenHeader exposes title and supporting meta without forcing a back button',()=>{
  const html=renderToStaticMarkup(React.createElement(ScreenHeader,{
    title:'모험가의 가방',meta:'보유 28종',
  }));
  assert.match(html,/모험가의 가방/);
  assert.match(html,/보유 28종/);
  assert.doesNotMatch(html,/뒤로/);
});

test('SegmentTabs marks exactly one active option',()=>{
  const html=renderToStaticMarkup(React.createElement(SegmentTabs,{
    items:[{value:'all',label:'전체'},{value:'gear',label:'장비'}],
    value:'gear',
    onChange:()=>{},
    label:'가방 분류',
  }));
  assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
  assert.match(html,/가방 분류/);
});
