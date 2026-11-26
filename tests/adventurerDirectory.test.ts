import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('adventurer inspection is read-only and available from chat and guild members',()=>{
 const read=(p:string)=>readFileSync(p,'utf8');
 assert.match(read('src/components/WorldChat.tsx'),/openAdventurerProfile\(message.userId\)/);
 assert.match(read('src/components/association/AssociationScreen.tsx'),/openAdventurerProfile\(member.userId\)/);
 assert.match(read('src/main.tsx'),/<AdventurerDirectory/);
 const ui=read('src/components/growth/AdventurerDirectory.tsx');
 for(const label of ['캐릭터 정보','모험가 랭킹','장착 장비','전투 인장','수호 인장'])assert.ok(ui.includes(label),'missing UI label: '+label);
 assert.doesNotMatch(ui,/onConfirm|onEquipment|onStats|foodTurns|combatPowerSkillBonus/);
});

test('offline guild lab opens the production character directory with simulated players',()=>{
 const lab=readFileSync('src/guildLab/real.tsx','utf8'),mock=readFileSync('src/guildLab/mockBackend.ts','utf8');
 assert.match(lab,/<AdventurerDirectory lease=\{LAB_LEASE\}/);
 assert.match(lab,/initialView==='adventurers'/);
 assert.match(lab,/initialRankings=\{initialView==='rankings'\}/);
 assert.match(mock,/case'get_adventurer_directory':return adventurerDirectory/);
 assert.match(lab,/initiallyOpen=\{initialView==='adventurers'\}/);
 assert.doesNotMatch(lab,/setTimeout\(openAdventurerRanking/);
 assert.match(mock,/sender_combat_power/);
 assert.match(mock,/LAB_BLOCKED_REAL_BACKEND/);
 assert.doesNotMatch(readFileSync('src/main.tsx','utf8'),/guildLab\/mockBackend/);
});

test('character inspection preserves the original combat power banner aspect ratio',()=>{
 const asset=readFileSync('src/assets/ui/growth/combat-power-banner.webp');
 // The approved asset is a VP8 WebP; read its actual frame dimensions.
 assert.equal(asset.toString('ascii',12,16),'VP8 ');
 const width=asset.readUInt16LE(26)&0x3fff,height=asset.readUInt16LE(28)&0x3fff;
 const css=readFileSync('src/components/growth/adventurer-directory.css','utf8');
 const rule=css.match(/\.tc-adventurer-power\{([^}]+)\}/)?.[1]??'';
 assert.match(rule,new RegExp('aspect-ratio:'+width+'/'+height+'(?:;|$)'));
 assert.match(rule,/background:[^;]*combat-power-banner\.webp[^;]*center\/contain no-repeat/);
 assert.match(rule,/height:auto/);
 assert.doesNotMatch(rule,/height:68px|100% 100%/);
 assert.match(rule,/width:100%/);
 assert.match(rule,/flex:none/);
});

test('public profile hides the crossed-swords crest without stretching or replacing the banner',()=>{
 const css=readFileSync('src/components/growth/adventurer-directory.css','utf8');
 const rule=css.match(/\.tc-adventurer-power\{([^}]+)\}/)?.[1]??'';
 const cover=css.match(/\.tc-adventurer-power::before\{([^}]+)\}/)?.[1]??'';
 assert.match(rule,/position:relative/);
 assert.match(rule,/grid-template-columns:17% minmax\(0,66%\) 17%/);
 assert.match(cover,/background-image:url\('\.\.\/\.\.\/assets\/ui\/growth\/combat-power-banner\.webp'\)/);
 assert.match(cover,/background-size:100cqw auto/);
 assert.match(cover,/mask-composite:intersect/);
 assert.match(cover,/pointer-events:none/);
 assert.match(css,/\.tc-adventurer-power>span\{[^}]*z-index:1/);
});

test('guild HQ, recruitment, and the hub use the same switchable leaderboard',()=>{
 const read=(p:string)=>readFileSync(p,'utf8');
 const directory=read('src/components/growth/AdventurerDirectory.tsx');
 const board=read('src/components/association/GuildRankingPanel.tsx');
 for(const file of ['AssociationScreen','GuildRecruitmentBoard']){
  assert.match(read('src/components/association/'+file+'.tsx'),/<GuildRankingPanel lease=\{lease\}/);
 }
 assert.match(directory,/<GuildRankingPanel lease=\{lease\} initialTab="personal"/);
 assert.match(board,/initialTab\s*=\s*'guild'/);
 assert.match(board,/role="tablist" aria-label="랭킹 종류"/);
 assert.match(board,/role="tab"/);
 assert.match(board,/aria-selected=/);
 assert.match(board,/role="tabpanel"/);
 assert.match(board,/getGuildRankings\(lease,'OVERALL'\)/);
 assert.match(board,/getAdventurerRanking/);
 assert.match(board,/openAdventurerProfile\(entry.userId,\s*true\)/);
 assert.match(board,/원정단명 검색/);
 assert.match(board,/entry.guildEmblem/);
 assert.match(read('src/guildLab/mockBackend.ts'),/mine:ranked\.find/);
});

test('personal rewards open independently of the two standings tabs',()=>{
 const board=readFileSync('src/components/association/GuildRankingPanel.tsx','utf8');
 const rewards=readFileSync('src/components/growth/PersonalRankingRewards.tsx','utf8');
 assert.match(board,/<PersonalRankingRewards ownRank=\{ownRank\}/);
 assert.match(rewards,/<GuildTask title="월간 보상"/);
 assert.match(rewards,/tierForRank\(ownRank\)/);
 for(const amount of [100,80,60,40,25,10])assert.ok(rewards.includes('amount: '+amount+' }'));
});

test('both standings use the guild row grid and its original podium frame sizing',()=>{
 const board=readFileSync('src/components/association/GuildRankingPanel.tsx','utf8');
 const css=readFileSync('src/components/association/guildRankings.css','utf8');
 assert.equal((board.match(/<RankingSummary\b/g)??[]).length,2);
 assert.match(css,/background:var\(--rank-art\) center\/contain no-repeat/);
 for(const rank of [1,2,3])assert.ok(css.includes('guild-rank-'+rank+'.webp'));
});

test('switching standings captures the visible list before hiding it and restores its own offset',()=>{
 const ui=readFileSync('src/components/association/GuildRankingPanel.tsx','utf8');
 const switchTab=ui.slice(ui.indexOf('const selectTab='),ui.indexOf('const onTabKey='));
 assert.match(switchTab,/scrollTopByTab\.current\[tab\]\s*=\s*activeList\.current\.scrollTop/);
 assert.ok(switchTab.indexOf('activeList.current.scrollTop')<switchTab.indexOf('setTab(next)'));
 assert.match(ui,/useLayoutEffect\(\(\)=>\{[^}]*activeList\.current\.scrollTop\s*=\s*scrollTopByTab\.current\[tab\]/);
 assert.match(ui,/GuildStandings lease=\{lease\} listRef=\{guildList\}/);
 assert.match(ui,/PersonalStandings lease=\{lease\} listRef=\{personalList\}/);
});
