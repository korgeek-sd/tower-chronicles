import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync('src/components/association/AssociationScreen.tsx','utf8');
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

test('gatehouse art and layout are limited to the headquarters overview',()=>{
 assert.match(online,/tab==='overview'[^\n]+tc-gatehouse/);
 const styles=readFileSync('src/components/association/gatehouse.css','utf8');
 assert.match(online,/assets\/backgrounds\/hub\/novar-moonlit-v3\.webp/);
 assert.match(styles,/tc-courtyard-places/);
 assert.equal((online.match(/className="tc-hq-feature"/g)||[]).length,6);
 assert.match(online,/tc-courtyard-dispatch/);
 assert.match(online,/current\.treasurySilver\.toLocaleString/);
 assert.match(online,/current\.members\.length/);
 assert.match(online,/territorySummary\?territorySummary\.ownedCount/);
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

test('courtyard preserves guild counters and illustrated facility labels',()=>{
 const css=readFileSync('src/components/association/gatehouse.css','utf8');
 assert.match(css,/tc-courtyard-places/);
 assert.match(css,/gate-icons\.webp/);
 assert.match(screen,/tc-gate-stats/);
 assert.match(css,/tc-gate-stats/);
});

test('home crest, name and growth meter share a dedicated header above the tabs',()=>{
 assert.match(online,/tab==='overview'&&<header className="tc-gate-identity"/);
 assert.match(online,/className="tc-gate-meter" role="progressbar"/);
 assert.match(online,/tab!=='overview'&&tab!=='boss'/);
 const css=readFileSync('src/components/association/gatehouse.css','utf8');
 assert.match(css,/tc-courtyard-scene/);
});
