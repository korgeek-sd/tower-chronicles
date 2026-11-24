import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
const home=core.slice(core.indexOf('export function HomeScreen'),core.indexOf('export function SkillsScreen'));
test('concept one retains all facility routes and only shows vitality on the hub',()=>{
 assert.match(home,/tc-novar-concept-one/);
 assert.doesNotMatch(home,/<b>HP<\/b>|<b>MP<\/b>/);
 assert.match(home,/huntStatus\?\.vitality/);
 for(const route of ['craft','skills','gold-exchange','occupation','quests','seal','cosmetics','bank','character','growth','stats','bestiary','inventory','settings','world','market-trends'])assert.ok(home.includes(`onMove('${route}')`),route);
 assert.match(home,/onOpenJobs\('register'\)/);assert.match(home,/onOpenJobs\('list'\)/);
 assert.match(home,/game.expedition\?'battle':'hunt'/);
 assert.match(home,/id="tc-camp-chat-dock"/);
 assert.match(home,/aria-expanded=\{showAllFacilities\}/);
 assert.match(home,/e.key==='Escape'/);
 assert.match(home,/facilityToggle.current\?\.focus\(\)/);
});

test('hub has one utility entry and plain facility card backgrounds',()=>{
 assert.doesNotMatch(home,/tc-novar-all|전체 시설/);
 assert.match(home,/ref=\{facilityToggle\}[^\n]*tc-novar-utilities/);
 const css=readFileSync(new URL('../src/components/mobile/novar-concept-one.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/url\(/);
 assert.match(css,/grid-template-columns:1\.9fr 1fr/);
 assert.match(home,/assets\/backgrounds\/hub\/novar-concept-one.webp/);
});

test('approved Novar style has precedence over legacy skins regardless of CSS bundle order',()=>{
 const css=readFileSync(new URL('../src/components/mobile/novar-concept-one.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/Final hub layout contract/);
 assert.match(css,/\.tc-screen\.tc-novar-concept-one \.tc-camp-v2-dossier\{[^}]*grid-template-columns:50px minmax\(0,1fr\) minmax\(100px,\.9fr\)/);
 assert.match(css,/\.tc-screen\.tc-novar-concept-one \.tc-camp-v2-quick\{position:static;inset:auto;display:grid;/);
 assert.match(css,/\.tc-screen\.tc-novar-concept-one \.tc-camp-v2-quick button\{position:relative;inset:auto!important;transform:none;display:flex;/);
 assert.match(css,/\.tc-screen\.tc-novar-concept-one \.tc-camp-v2-primary\{display:grid;grid-template-columns:1\.9fr 1fr;/);
 assert.match(css,/\.tc-screen\.tc-novar-concept-one \.tc-camp-v2-chat-dock\{margin:0;height:44px;min-height:44px;/);
});
