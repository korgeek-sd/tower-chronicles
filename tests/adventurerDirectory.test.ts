import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('adventurer inspection is read-only and available from chat and guild members',()=>{
 const read=(p:string)=>readFileSync(p,'utf8');
 assert.match(read('src/components/WorldChat.tsx'),/openAdventurerProfile\(message.userId\)/);
 assert.match(read('src/components/association/AssociationScreen.tsx'),/openAdventurerProfile\(member.userId\)/);
 assert.match(read('src/main.tsx'),/<AdventurerDirectory/);
 const ui=read('src/components/growth/AdventurerDirectory.tsx');
 for(const label of ['캐릭터 정보','모험가 랭킹','개인 전투력','원정단 전투력','닉네임 검색','장착 장비','전투 인장','수호 인장'])assert.ok(ui.includes(label),'missing UI label: '+label);
 assert.doesNotMatch(ui,/onConfirm|onEquipment|onStats|foodTurns|combatPowerSkillBonus/);
});

test('offline guild lab opens the production character directory with simulated players',()=>{
 const lab=readFileSync('src/guildLab/real.tsx','utf8'),mock=readFileSync('src/guildLab/mockBackend.ts','utf8');
 assert.match(lab,/<AdventurerDirectory lease=\{LAB_LEASE\}/);
 assert.match(lab,/get\('view'\)==='adventurers'/);
 assert.match(mock,/case'get_adventurer_directory':return adventurerDirectory/);
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

test('ranking redesign fixes own rank outside the scrolling list and supports both ranking modes',()=>{
 const ui=readFileSync('src/components/growth/AdventurerDirectory.tsx','utf8'),css=readFileSync('src/components/growth/adventurer-directory.css','utf8'),mock=readFileSync('src/guildLab/mockBackend.ts','utf8');
 assert.match(ui,/개인 전투력/);assert.match(ui,/원정단 전투력/);
 assert.match(ui,/getGuildRankings\(lease,'OVERALL'\)/);
 assert.match(ui,/ranking\.mine/);assert.match(ui,/entry\.guildEmblem/);
 assert.match(ui,/className="tc-adventurer-rank-list"/);
 assert.match(ui,/className="tc-adventurer-own-rank"/);
 assert.match(css,/\.tc-adventurer-rank-list\{[^}]*overflow-y:auto/);
 assert.match(css,/\.tc-adventurer-own-rank\{[^}]*flex:none/);
 for(const rank of [1,2,3])assert.ok(css.includes('[data-rank="'+rank+'"]'));
 assert.match(mock,/mine:ranked\.find/);
});
