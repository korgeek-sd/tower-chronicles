import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/components/association/hq-v2.css',import.meta.url),'utf8');

test('pixel guild HQ exposes exactly five major groups while keeping all 11 existing features',()=>{
 const primary=['overview','combat','territory','assets','people'];
 const sections=[...screen.matchAll(/\{id:'(overview|combat|territory|assets|people)',label:'([^']+)',art:'([^']+)',first:'([^']+)',tabs:\[([^\]]+)\]\}/g)];
 assert.deepEqual(sections.map(m=>m[1]),primary);
 assert.deepEqual(sections.map(m=>m[2]),['본부','전투','영지','자산','단원']);
 const routes=sections.flatMap(m=>[...m[5].matchAll(/'([^']+)'/g)].map(x=>x[1]));
 assert.equal(routes.length,11);
 assert.equal(new Set(routes).size,11);
 for(const route of ['overview','rankings','activity','boss','territory','warehouse','shop','auction','members','applications','manage']){
  assert.ok(routes.includes(route),route);
 }
 for(const match of sections){
  assert.ok(existsSync('public/assets/ui/navigation/'+match[3]+'.png'),match[3]+' art is missing');
 }
 assert.ok(existsSync('public/assets/backgrounds/hub/novar-moonlit-v3.webp'));
 assert.match(screen,/role="tablist" aria-label="원정단 주요 메뉴"/);
 assert.match(screen,/className="tc-company-nav-art"/);
 assert.match(screen,/onChange=\{navigate\}/);
});

test('guild overhaul retains actual live data, occupation navigation and all original panels',()=>{
 for(const token of ['GuildBossPanel','GuildAuctionPanel','GuildTerritoryPanel','GuildRankingPanel',
  'AssociationWarehousePanel','AssociationSupplyPanel','getGuildTerritoryState','territorySummary.ownedCount',
  'current.members.length','current.treasurySilver.toLocaleString()','current.revenueShareRatePercent',
  'setGuildVillageTax','reviewOnlineAssociationApplication','updateOnlineAssociation',
  'kickOnlineAssociationMember','transferOnlineAssociationLeadership','disbandOnlineAssociation',
  'leaveOnlineAssociation','tower-open-association-chat']){
  if(token==='setGuildVillageTax')assert.match(readFileSync('src/components/association/GuildTerritoryPanel.tsx','utf8'),/setGuildVillageTax/);
  else assert.ok(screen.includes(token),token);
 }
 assert.match(screen,/onAuction=\{\(\)=>setTab\('auction'\)\}/);
 assert.match(screen,/onClick=\{onOccupation\}/);
 assert.match(screen,/tab==='applications'&&leader/);
 assert.match(screen,/tab==='manage'&&leader/);
 assert.match(screen,/leader\?serverTabs:serverTabs.filter/);
 assert.match(screen,/\.filter\(\(\[id\]\)=>activeSection.tabs.includes\(id\)\)/);
});

test('pixel guild layout is scroll-safe on small phones and preserves font choice',()=>{
 assert.match(css,/tc-assoc-hq-v2/);
 assert.match(css,/tc-company-hero/);
 assert.match(css,/tc-company-mainnav/);
 assert.match(css,/tc-company-subnav-wrap/);
 assert.match(css,/tc-company-quicklinks/);
 assert.match(css,/tc-company-records/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/@media\(max-height:710px\)/);
 assert.doesNotMatch(css,/--game-font\s*:/);
 const body=screen.slice(screen.indexOf('function OnlineAssociationScreen'),screen.indexOf('function LocalAssociationScreen'));
 for(const tab of ['members','applications','activity']){
  assert.match(body,new RegExp("tab==='"+tab+"'[\\s\\S]*?tc-company-records"));
 }
});
