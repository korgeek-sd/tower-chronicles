import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync('src/components/association/AssociationScreen.tsx','utf8');
const icon=readFileSync('src/components/association/GuildLineIcon.tsx','utf8');
const classic=readFileSync('src/components/association/hq-v4.css','utf8');
const prior=readFileSync('src/components/association/hq-v2.css','utf8');
const online=screen.slice(screen.indexOf("return <Screen className={tab==='boss'"),screen.indexOf("   {tab==='members'&&"));

test('classic guild HQ has five major tabs and preserves all eleven server routes',()=>{
 const sections=[...screen.matchAll(/\{id:'(overview|combat|territory|assets|people)',label:'([^']+)',art:'([^']+)',first:'([^']+)',tabs:\[([^\]]+)\]\}/g)];
 assert.deepEqual(sections.map(s=>s[2]),['본부','전투','영지','자산','단원']);
 const routes=sections.flatMap(s=>[...s[5].matchAll(/'([^']+)'/g)].map(a=>a[1]));
 assert.equal(new Set(routes).size,11);
 for(const tab of ['overview','rankings','activity','boss','territory','warehouse','shop','auction','members','applications','manage'])
  assert.ok(routes.includes(tab),tab);
 assert.match(screen,/role="tablist" aria-label="원정단 주요 메뉴"/);
 assert.match(screen,/leader\?serverTabs:serverTabs.filter/);
 assert.match(screen,/tab==='applications'&&leader/);
 assert.match(screen,/tab==='manage'&&leader/);
});

test('classic line HQ has zero image assets and renders code-drawn line icons',()=>{
 assert.match(screen,/import \{GuildLineIcon,type GuildLineIconName\} from '\.\/GuildLineIcon';/);
 assert.match(screen,/import '\.\/hq-v4\.css';/);
 assert.doesNotMatch(screen,/assetUrl\(|<img|assets\/ui\/guild\/new\//);
 assert.doesNotMatch(classic,/url\(|background-image\s*:/);
 assert.match(icon,/Plain, in-code line icons/);
 assert.match(icon,/fill="none" stroke="currentColor"/);
 for(const name of ['crest','hq','combat','territory','assets','members','boss','siege','land','shop','vault','auction','notice','chat'])
  assert.match(icon,new RegExp(name+':<>'),name);
 assert.match(online,/<GuildLineIcon name="crest"\/>/);
 assert.match(online,/<GuildLineIcon name=\{section\.art\} className="tc-guild-line-icon tc-company-nav-line"\/>/);
 assert.equal((online.match(/className="tc-hq-feature"/g)||[]).length,6);
 assert.match(online,/tc-hq-line-overview/);
 assert.match(online,/current\.treasurySilver\.toLocaleString\(\)/);
 assert.match(online,/current\.members\.length/);
 assert.match(online,/territorySummary\?territorySummary\.ownedCount/);
});

test('classic 1 uses viewport-contained dashboard, 3x2 actions, scrollable dialog only',()=>{
 assert.match(classic,/tc-assoc-hq-v4:has\(>\.tc-hq-line-overview\)/);
 assert.match(classic,/grid-template-rows:clamp\(104px,20%,151px\) clamp\(48px,9%,66px\) minmax\(0,1fr\)/);
 assert.match(classic,/\.tc-hq-line-overview\{/);
 assert.match(classic,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(classic,/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(classic,/overflow:hidden/);
 assert.match(classic,/@media\(max-width:355px\)/);
 assert.match(classic,/@media\(max-height:680px\)/);
 assert.match(classic,/\.tc-hq-overlay-panel/);
 assert.match(classic,/overflow:auto/);
 assert.match(prior,/\.tc-company-records/);
 assert.doesNotMatch(classic,/--game-font\s*:/);
});

test('all guild functions remain connected to live data and existing permission rules',()=>{
 for(const token of ['GuildBossPanel','GuildAuctionPanel','GuildTerritoryPanel','GuildRankingPanel',
 'AssociationWarehousePanel','AssociationSupplyPanel','getGuildTerritoryState','loadAssociationProgression',
 'reviewOnlineAssociationApplication','updateOnlineAssociation','kickOnlineAssociationMember',
 'transferOnlineAssociationLeadership','disbandOnlineAssociation','leaveOnlineAssociation',
 'tower-open-association-chat','onClick={onOccupation}',"onAuction={()=>setTab('auction')}",
 'onClick={()=>setFullNotice(true)}','onClick={()=>setGrowthOpen(true)}'])
  assert.ok(screen.includes(token),token);
 assert.match(online,/role="dialog" aria-modal="true"/);
 assert.match(online,/mode="growth"/);
 assert.match(screen,/tc-company-subnav-wrap/);
 assert.match(readFileSync('src/components/association/GuildTerritoryPanel.tsx','utf8'),/setGuildVillageTax/);
});
