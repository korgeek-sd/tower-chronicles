import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MailDialogFrame} from '../src/components/MailDialog';
import {withMailTimeout} from '../src/online/mail';

test('mail close remains enabled while a transaction is pending',()=>{
 const html=renderToStaticMarkup(React.createElement(MailDialogFrame,{dialogRef:{current:null},onClose:()=>{},children:React.createElement('button',{disabled:true},'처리 중')}));
 assert.match(html,/<button[^>]*aria-label="우편함 닫기"/);
 assert.doesNotMatch(html,/<button[^>]*disabled[^>]*aria-label="우편함 닫기"/);
});
test('mail Escape and backdrop dismiss the modal without depending on transaction state',()=>{
 let closed=0,prevented=0;
 const frame=MailDialogFrame({dialogRef:{current:null},onClose:()=>closed++,children:null});
 frame.props.onCancel({preventDefault:()=>prevented++});
 assert.equal(closed,1);assert.equal(prevented,1);
 const element={getBoundingClientRect:()=>({left:10,right:110,top:20,bottom:120})};
 frame.props.onClick({target:element,currentTarget:element,clientX:5,clientY:25});
 assert.equal(closed,2);
 frame.props.onClick({target:element,currentTarget:element,clientX:30,clientY:40});
 assert.equal(closed,2);
});
test('stalled mail requests time out and abort, allowing a fresh request',async()=>{
 let signal:AbortSignal|undefined;
 await assert.rejects(withMailTimeout(s=>{signal=s;return new Promise(()=>{});},10),/새로고침/);
 assert.equal(signal?.aborted,true);
 assert.equal(await withMailTimeout(async()=>42,100),42);
});
