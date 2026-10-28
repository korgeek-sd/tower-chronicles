import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('seal reset requires an in-game confirmation and guards duplicate requests',()=>{
 const source=readFileSync('src/components/seal/SealScreen.tsx','utf8');
 assert.doesNotMatch(source,/window\.confirm/);
 assert.match(source,/onClick=\{\(\)=>\{setResetError\(''\);setResetOpen\(true\);\}\}/);
 assert.match(source,/!resetOpen\|\|resetPending\.current/);
 assert.ok(source.indexOf('resetPending.current=true')<source.indexOf('await resetOnlineSeal'));
 assert.match(source,/<SealResetDialog/);
 assert.match(source,/onConfirm=\{\(\)=>void reset\(\)\}/);
 assert.match(source,/finally\{resetPending.current=false;setBusy\(false\);\}/);
});

import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SealResetDialog} from '../src/components/seal/SealResetDialog';

test('reset dialog identifies the selected seal, cost, progress and safe cancel action',()=>{
 const props={sealName:'수호 인장',level:7,rolls:5,busy:false,error:'',canConfirm:true,onCancel:()=>{},onConfirm:()=>{}};
 const html=renderToStaticMarkup(React.createElement(SealResetDialog,props));
 for(const text of ['수호 인장','7단계','5회','3,000','Gold','다른 인장은 유지됩니다.','취소','재주조 확인'])assert.ok(html.includes(text),text);
 assert.match(html,/aria-labelledby="seal-reset-title"/);
 assert.doesNotMatch(html,/disabled=""/);
 const pending=renderToStaticMarkup(React.createElement(SealResetDialog,{...props,busy:true,canConfirm:false}));
 assert.equal((pending.match(/disabled=""/g)||[]).length,2);
 assert.match(pending,/재주조 중…/);
 const failed=renderToStaticMarkup(React.createElement(SealResetDialog,{...props,error:'요청에 실패했습니다.'}));
 assert.match(failed,/role="alert"/);
 assert.match(failed,/요청에 실패했습니다./);
});
