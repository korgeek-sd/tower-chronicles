import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SkillBookArt} from '../src/components/inventory/SkillBookArt';
import {GRADES} from '../src/game/skills/catalog';

test('all book grades share supplied artwork and vary only the frame',()=>{
 const bytes=readFileSync(new URL('../public/assets/ui/skillbook.jpg',import.meta.url));
 assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
 for(const grade of GRADES){
  const html=renderToStaticMarkup(React.createElement(SkillBookArt,{grade}));
  assert.ok(html.includes('assets/ui/skillbook.jpg'));
  assert.ok(html.includes('tc-skillbook-grade-'+grade.toLowerCase()));
 }
});
