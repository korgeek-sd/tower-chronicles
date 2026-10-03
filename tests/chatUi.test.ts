import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/components/world-chat.css',import.meta.url),'utf8');
const drag=readFileSync(new URL('../src/components/chatEntryDrag.ts',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('chat entry hugs the app edge and compacts during immersive play',()=>{
 assert.match(css,/\.tc-chat-entry\{[^}]*right:max\(0px,calc\(\(100vw - 520px\)\/2\)\)[^}]*width:62px[^}]*min-height:44px[^}]*border-right:0/s);
 assert.match(css,/\.tc-battle-mode>\.tc-chat-entry,\.tc-event-mode>\.tc-chat-entry\{[^}]*right:max\(0px,calc\(\(100vw - 620px\)\/2\)\)[^}]*width:44px[^}]*min-height:44px[^}]*opacity:\.58/s);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.tc-chat-entry\{transition:none\}/);
});
test('chat entry long press enables dragging without replacing tap-to-open',()=>{
 assert.match(html,/src="\/src\/components\/chatEntryDrag\.ts"/);
 assert.match(drag,/CHAT_ENTRY_LONG_PRESS_MS=500/);
 assert.match(drag,/addEventListener\('pointerdown'/);
 assert.match(drag,/addEventListener\('pointermove'/);
 assert.match(drag,/resolveChatEntryPlacement\(event\.clientX,event\.clientY/);
 assert.match(drag,/saveChatEntryPlacement\(mode,next\)/);
 assert.match(css,/\.tc-chat-entry\[data-side=left\]/);
 assert.match(css,/\.tc-chat-entry\[data-dragging=true\]/);
});
