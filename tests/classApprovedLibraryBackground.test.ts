import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('approved red-moon gothic library painting is committed and used only in the class screen',()=>{
 const image=readFileSync('public/assets/backgrounds/classes/class-library-redmoon-approved-v2.webp');
 assert.ok(image.byteLength>100_000,'full-resolution approved art retained');
 assert.equal(image.subarray(0,4).toString('ascii'),'RIFF');
 assert.equal(image.subarray(8,12).toString('ascii'),'WEBP');
 const screen=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 assert.match(screen,/assets\/backgrounds\/classes\/class-library-redmoon-approved-v2\.webp/);
 assert.doesNotMatch(screen,/class-library-v1\.svg/);
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 assert.match(css,/\.tc-class-ambience\s*\{[^}]*background-size:\s*cover/);
 assert.match(css,/\.tc-class-ambience\s*\{[^}]*background-position:\s*center top/);
 assert.match(css,/\.tc-class-content/);
 assert.match(css,/\.tc-class-footer/);
});
