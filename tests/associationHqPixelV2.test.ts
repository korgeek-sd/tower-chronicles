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

test('top three guild ranks use the approved illustrated art without changing ordinary rows',()=>{
 const ui=readFileSync('src/components/association/GuildRankingPanel.tsx','utf8');
 const css=readFileSync('src/components/association/guildRankings.css','utf8');
 assert.match(ui,/data-podium=\{entry\.rank>=1&&entry\.rank<=3\?entry\.rank:undefined\}/);
 assert.match(ui,/<RankNumber rank=\{entry\.rank\}\/>/);
 for(const rank of [1,2,3]){
  const file='guild-rank-'+rank+'.webp';
  const asset=readFileSync('src/assets/ui/guild/'+file);
  assert.equal(asset.toString('ascii',0,4),'RIFF');
  assert.equal(asset.toString('ascii',8,12),'WEBP');
  const rule=css.match(new RegExp('\\[data-podium="'+rank+'"\\]\\{([^}]+)\\}'))?.[1]??'';
  assert.ok(rule.includes(file));
  assert.ok(rule.includes('--rank-ratio:2172/650'));
  assert.equal(asset.toString('ascii',12,16),'VP8X');
  assert.equal(asset.readUIntLE(24,3)+1,2172);
  assert.equal(asset.readUIntLE(27,3)+1,650);
 }
 assert.match(css,/aspect-ratio:var\(--rank-ratio\)/);
 assert.match(css,/background-size:contain/);
 assert.match(css,/\.tc-gr-entry\[data-podium\] \.tc-gr-rank\{[^}]*opacity:0/);
});
