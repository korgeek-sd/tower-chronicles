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
