import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  viewportBand,
  pageSizeFor,
  clampPageIndex,
  pageSlice,
} from '../src/components/mobile/mobilePagination';
import {useViewportHeight} from '../src/components/mobile/useViewportHeight';

test('viewport bands match the mobile spec',()=>{
  assert.equal(viewportBand(640),'compact');
  assert.equal(viewportBand(719),'compact');
  assert.equal(viewportBand(720),'standard');
  assert.equal(viewportBand(899),'standard');
  assert.equal(viewportBand(900),'tall');
});

test('surface page sizes shrink instead of scaling the UI',()=>{
  assert.equal(pageSizeFor('inventory',640),12);
  assert.equal(pageSizeFor('inventory',800),16);
  assert.equal(pageSizeFor('inventory',950),20);
  assert.equal(pageSizeFor('market',640),4);
  assert.equal(pageSizeFor('market',800),5);
  assert.equal(pageSizeFor('market',950),6);
  assert.equal(pageSizeFor('recipes',640),2);
  assert.equal(pageSizeFor('recipes',800),3);
  assert.equal(pageSizeFor('recipes',950),4);
});

test('page index clamps after filtering shrinks a collection',()=>{
  assert.equal(clampPageIndex(4,5,4),1);
  assert.equal(clampPageIndex(2,0,4),0);
});

test('pageSlice never leaks items from adjacent pages',()=>{
  assert.deepEqual(pageSlice([1,2,3,4,5],0,2),[1,2]);
  assert.deepEqual(pageSlice([1,2,3,4,5],2,2),[5]);
});


function HeightProbe(){
  const height=useViewportHeight();
  return React.createElement('span',null,String(height));
}

test('viewport height hook has a stable SSR fallback',()=>{
  assert.equal(renderToStaticMarkup(React.createElement(HeightProbe)),'<span>844</span>');
});
