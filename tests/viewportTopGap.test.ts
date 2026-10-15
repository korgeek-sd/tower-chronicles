import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('viewport meta does not force viewport-fit=cover to avoid top safe-area blank gaps on mobile',()=>{
 assert.doesNotMatch(html,/viewport-fit=cover/,'viewport-fit=cover induces safe-area blank top padding on mobile browsers');
 assert.match(html,/content="width=device-width,\s*initial-scale=1\.0/);
});

test('apple status bar style uses black instead of black-translucent to prevent top safe area offset',()=>{
 assert.doesNotMatch(html,/content="black-translucent"/);
 assert.match(html,/name="apple-mobile-web-app-status-bar-style"\s+content="black"/);
});

test('mobile game css does not add safe-area-inset-top padding or extra height to tc-topbar or tc-app',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.tc-topbar\{[^}]*padding-top:\s*env\(safe-area-inset-top\)/,'tc-topbar must not have safe-area padding top');
 assert.doesNotMatch(css,/\.tc-app\{[^}]*grid-template-rows:\s*calc\([^)]*safe-area-inset-top\)/,'tc-app row 1 must not expand by safe-area-inset-top');
});
