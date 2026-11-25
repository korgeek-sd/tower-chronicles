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
 assert.match(online,/assets\/backgrounds\/association\/guild-courtyard-v3\.webp/);
 assert.doesNotMatch(online,/assets\/backgrounds\/hub\/novar-moonlit-v3\.webp/);
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

test('all member pages share the crest, growth header and pixel navigation',()=>{
 assert.match(online,/<header className="tc-gate-identity"/);
 assert.doesNotMatch(online,/tab==='overview'&&<header/);
 assert.match(online,/className="tc-gate-meter" role="progressbar"/);
 assert.doesNotMatch(online,/tc-company-hero is-compact/);
 const nav=screen.slice(screen.indexOf('const sectionNav='),screen.indexOf('const playerArt='));
 assert.match(nav,/<HubIcon/);
 assert.doesNotMatch(nav,/GuildLineIcon/);
 assert.match(online,/tc-gate-detail/);
 const css=readFileSync('src/components/association/gatehouse.css','utf8');
 assert.match(css,/tc-courtyard-scene/);
});

test('guild ranking reserves space for the complete power-ranked list',()=>{
 const ui=readFileSync('src/components/association/GuildRankingPanel.tsx','utf8');
 const css=readFileSync('src/components/association/guild-workspace.css','utf8');
 assert.doesNotMatch(ui,/tc-adventurer-rank-entry|tc-gr-modes|tc-gr-search|tc-gr-pages|PAGE_SIZE/);
 assert.match(ui,/getGuildRankings\(lease,'OVERALL'\)/);
 assert.match(ui,/rows\.map\(entry=><Row/);
 assert.match(ui,/<GuildTask title=\{entry\.name\+' 상세'\}/);
 assert.match(css,/\.tc-guild-workspace \.tc-gr-list\s*\{[^}]*overflow-y:\s*auto/);
});

test('guild podium uses original compact artwork and image icons with live ranking data',()=>{
 const ui=readFileSync('src/components/association/GuildRankingPanel.tsx','utf8');
 const css=readFileSync('src/components/association/guildRankings.css','utf8');
 assert.match(ui,/data-podium=\{entry\.rank>=1&&entry\.rank<=3\?entry\.rank:undefined\}/);
 assert.match(ui,/<RankNumber rank=\{entry\.rank\}\/>/);
 assert.match(ui,/<GuildEmblem value=\{entry\.emblem\}/);
 assert.match(ui,/<RankingIcon kind="power"\/>/);
 assert.match(ui,/<RankingIcon kind="crown"\/>/);
 assert.match(ui,/<img className="tc-gr-stat-icon"/);
 assert.doesNotMatch(ui,/PodiumFrame|<svg/);
 assert.match(css,/grid-auto-rows:max-content/);
 assert.match(css,/--rank-height:48px/);
 assert.match(css,/height:var\(--rank-height\)/);
 assert.match(css,/background:var\(--rank-art\) center\/100% 100% no-repeat/);
 assert.doesNotMatch(css,/tc-gr-podium-frame|tc-gr-podium-crown|clip-path:polygon|tc-gr-rank::/);
 for(const rank of [1,2,3]){
  const file='guild-rank-'+rank+'.webp';
  const asset=readFileSync('src/assets/ui/guild/'+file);
  assert.equal(asset.toString('ascii',0,4),'RIFF');
  assert.equal(asset.toString('ascii',8,12),'WEBP');
  const rule=css.match(new RegExp('\\[data-podium="'+rank+'"\\]\\{([^}]+)\\}'))?.[1]??'';
  assert.ok(rule.includes(file));
  assert.equal(asset.toString('ascii',12,16),'VP8X');
  assert.equal(asset.readUIntLE(24,3)+1,1440);
  assert.equal(asset.readUIntLE(27,3)+1,rank===1?376:267);
 }
 for(const icon of ['crown','power']){
  const file='guild-ranking-'+icon+'.webp';
  const asset=readFileSync('src/assets/ui/guild/'+file);
  assert.ok(ui.includes(file));
  assert.equal(asset.toString('ascii',8,12),'WEBP');
 }
});
