import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const screen=readFileSync('src/components/association/AssociationScreen.tsx','utf8');
const homeCss=readFileSync('src/components/association/hq-v3.css','utf8');
const legacyCss=readFileSync('src/components/association/hq-v2.css','utf8');
const base='public/assets/ui/guild/new/';

test('guild navigation has five custom illustrated sections and retains all eleven actions',()=>{
 const sections=[...screen.matchAll(/\{id:'(overview|combat|territory|assets|people)',label:'([^']+)',art:'([^']+)',first:'([^']+)',tabs:\[([^\]]+)\]\}/g)];
 assert.deepEqual(sections.map(s=>s[2]),['본부','전투','영지','자산','단원']);
 const routes=sections.flatMap(s=>[...s[5].matchAll(/'([^']+)'/g)].map(a=>a[1]));
 assert.equal(new Set(routes).size,11);
 for(const tab of ['overview','rankings','activity','boss','territory','warehouse','shop','auction','members','applications','manage'])
  assert.ok(routes.includes(tab),tab);
 for(const section of sections)assert.ok(existsSync(base+'nav-'+section[3]+'.svg'),section[3]);
 assert.match(screen,/assets\/ui\/guild\/new\/nav-'\+section\.art\+'\.svg/);
 assert.match(screen,/role="tablist" aria-label="원정단 주요 메뉴"/);
 assert.match(screen,/leader\?serverTabs:serverTabs.filter/);
 assert.match(screen,/tab==='manage'&&leader/);
 assert.match(screen,/tab==='applications'&&leader/);
});
test('HQ has 6 unique illustrated actions, original banner art, member assets and progress popup',()=>{
 for(const art of ['castle.svg','emblem.svg','nav-hq.svg','nav-combat.svg','nav-territory.svg','nav-assets.svg','nav-members.svg',
  'action-boss.svg','action-siege.svg','action-land.svg','action-shop.svg','action-vault.svg','action-auction.svg'])
  assert.ok(existsSync(base+art),art);
 const slice=screen.slice(screen.indexOf("return <Screen className={tab==='boss'"),screen.indexOf("   {tab==='members'&&"));
 assert.ok(slice.length>500);
 assert.match(slice,/hideHeader>/);
 assert.match(slice,/assets\/ui\/guild\/new\/castle\.svg/);
 assert.match(slice,/assets\/ui\/guild\/new\/emblem\.svg/);
 assert.match(slice,/tc-assoc-hq-v3/);
 assert.match(slice,/className="tc-company-overview tc-hq-fixed-overview"/);
 assert.match(slice,/tc-hq-feature-grid/);
 assert.equal((slice.match(/className="tc-hq-feature"/g)||[]).length,6);
 for(const name of ['boss','siege','land','shop','vault','auction'])
  assert.ok(slice.includes('assets/ui/guild/new/action-'+name+'.svg'),name);
 assert.doesNotMatch(slice,/assets\/ui\/navigation(?:-new)?\//);
 assert.doesNotMatch(slice,/assets\/ui\/guild\/concept2-/);
 assert.match(slice,/loadAssociationProgression|heroProgress\?\.associationLevel|heroLevel\?Math\.round/);
 assert.match(slice,/onClick=\{\(\)=>setGrowthOpen\(true\)\}/);
 assert.match(slice,/role="dialog" aria-modal="true"/);
 assert.match(slice,/mode="growth"/);
 assert.match(slice,/current\.notice\|\|'등록된 공지가 없습니다\.'/);
 assert.match(slice,/tower-open-association-chat/);
});
test('new overview never scrolls; overlays retain old donation and notices',()=>{
 assert.match(homeCss,/tc-assoc-hq-v3/);
 assert.match(homeCss,/grid-template-rows:clamp\(95px,22%,148px\) clamp\(46px,9%,62px\) minmax\(0,1fr\)/);
 assert.match(homeCss,/\.tc-company-overview\.tc-hq-fixed-overview\{/);
 assert.match(homeCss,/grid-template-rows:clamp\(40px,10\.5%,54px\) minmax\(0,1fr\) clamp\(29px,7\.5%,37px\) clamp\(29px,7\.5%,37px\)/);
 assert.match(homeCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(homeCss,/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(homeCss,/overflow:hidden/);
 assert.match(homeCss,/@media\(max-width:355px\)/);
 assert.match(homeCss,/@media\(max-height:680px\)/);
 assert.match(homeCss,/tc-hq-overlay-panel/);
 assert.match(homeCss,/overflow:auto/); // only dialog scrolls
 assert.doesNotMatch(homeCss,/--game-font\s*:/);
 assert.match(legacyCss,/\.tc-company-records/);
 assert.match(screen,/tc-company-subnav-wrap/);
});
test('all former guild server operations remain wired to their detailed pages',()=>{
 for(const token of ['GuildBossPanel','GuildAuctionPanel','GuildTerritoryPanel','GuildRankingPanel','AssociationWarehousePanel',
  'AssociationSupplyPanel','getGuildTerritoryState','territorySummary.ownedCount','current.members.length',
  'current.treasurySilver.toLocaleString()','current.revenueShareRatePercent',
  'reviewOnlineAssociationApplication','updateOnlineAssociation','kickOnlineAssociationMember',
  'transferOnlineAssociationLeadership','disbandOnlineAssociation','leaveOnlineAssociation',
  'tower-open-association-chat','onClick={onOccupation}','onAuction={()=>setTab(\'auction\')}'])
  assert.ok(screen.includes(token),token);
 assert.match(readFileSync('src/components/association/GuildTerritoryPanel.tsx','utf8'),/setGuildVillageTax/);
});
