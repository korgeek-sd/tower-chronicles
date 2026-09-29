import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('JOB REGISTRATION UI 01: mobile job screen exposes registration and list tabs',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/직능등록/);
 assert.match(source,/직능목록/);
 assert.match(source,/10\+1 등록/);
 assert.match(source,/1,000 Gold · 총 11개/);
 assert.match(source,/SR 집중 열람/);
 assert.match(source,/SSR 집중 열람/);
 assert.match(source,/직능기록/);
 assert.match(source,/확률정보/);
});

test('JOB REGISTRATION UI 02: registration UI calls only server registration RPC wrappers',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/registerOnlineJob\(onlineLease,paidRolls\)/);
 assert.match(source,/getOnlineJobRegistrationState\(onlineLease\)/);
 assert.match(source,/setOnlineJobRegistrationPickups\(onlineLease,next\)/);
 assert.match(source,/exchangeOnlineJobResidualRecord\(onlineLease,jobId\)/);
 assert.match(source,/exchangeOnlineJobResidualRecommendation\(onlineLease\)/);
 assert.doesNotMatch(source,/Math\.random\(/);
});

test('JOB REGISTRATION UI 03: gacha UI permits job character art but no decorative UI assets',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.equal(source.includes('assets/ui'),false);
 assert.match(source,/tc-reg-job-art/);
 assert.match(source,/assetUrl\(job\.visualAssetKey\)/);
 assert.match(source,/tc-reg-vault-icon/);
 assert.match(source,/tc-reg-record-icon/);
 assert.match(css,/\.tc-registration\{height:100%;min-height:0;[^}]*display:grid/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});


test('JOB REGISTRATION UI 04: mobile controls keep usable touch targets',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-job-hub>\.tc-segments button\{min-height:42px/);
 assert.match(css,/\.tc-reg-pickups select\{[^}]*height:42px;min-height:42px/);
 assert.match(css,/\.tc-reg-draw\{[^}]*min-height:48px;height:52px/);
 assert.match(css,/\.tc-reg-result-foot>\.tc-action\{[^}]*min-height:44px;height:44px/);
});

test('JOB REGISTRATION UI 05: 10+1 result grid favors readable three-card rows and stays clipped to the viewport',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-reg-result\{height:100%;min-height:0;overflow:hidden\}/);
 assert.match(css,/\.tc-reg-result-grid\{[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\);grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tc-reg-mini\{[^}]*grid-column:span 2/);
 assert.match(css,/\.tc-reg-mini:nth-child\(10\)\{grid-column:2\/span 2\}/);
 assert.match(css,/@media\(max-height:620px\)/);
 assert.match(css,/\.tc-job-hub\{grid-template-rows:44px minmax\(0,1fr\)\}/);
 assert.match(css,/\.tc-reg-result-multi\{grid-template-rows:32px minmax\(0,1fr\) 46px/);
});


test('JOB REGISTRATION UI 06: pixel archive skin is CSS-only and preserves compact overrides',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 const registrationCss=css.slice(css.indexOf('/* ===== Job registration / sealed archive ===== */'));
 assert.doesNotMatch(source,/https?:\/\//);
 assert.doesNotMatch(registrationCss,/url\(/);
 assert.match(registrationCss,/Job registration pixel skin \/ original CSS-only treatment/);
 assert.match(css,/\.tc-reg-draw:before,.tc-reg-draw:after/);
 assert.match(css,/\.tc-reg-mini:after/);
 assert.match(css,/Preserve the one-screen mobile contract after the decorative skin overrides/);
 assert.match(css,/@media\(max-height:620px\)\{[\s\S]*\.tc-reg-vault-icon\{width:54px;height:38px\}/);
});


test('JOB REGISTRATION UI 07: records view exposes server quotas and recommendation conversion',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.match(source,/협회 추천장 \+1/);
 assert.match(source,/잔여 기록/);
 assert.match(source,/stageLabel\(count\)/);
 assert.match(source,/exchangeUsage/);
 assert.match(css,/\.tc-reg-records\{/);
 assert.match(css,/\.tc-reg-record-list\{/);
 assert.match(css,/\.tc-reg-recommend\{/);
});

test('JOB REGISTRATION UI 08: probability view documents pickup and reset rules without client RNG',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/픽업 직능 2\.5%/);
 assert.match(source,/픽업 직능 0\.5%/);
 assert.match(source,/10\/30\/60 성장 기준/);
 assert.match(source,/매주 월요일 00:00/);
 assert.match(source,/매월 1일 00:00\(KST\)/);
 assert.doesNotMatch(source,/Math\.random\(/);
});
