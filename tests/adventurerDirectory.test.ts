import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('adventurer inspection is read-only and available from chat and guild members',()=>{
 const read=(p:string)=>readFileSync(p,'utf8');
 assert.match(read('src/components/WorldChat.tsx'),/openAdventurerProfile\(message.userId\)/);
 assert.match(read('src/components/association/AssociationScreen.tsx'),/openAdventurerProfile\(member.userId\)/);
 assert.match(read('src/main.tsx'),/<AdventurerDirectory/);
 const ui=read('src/components/growth/AdventurerDirectory.tsx');
 for(const label of ['캐릭터 정보','개인 전투력 랭킹','닉네임 검색','장착 장비','전투 인장','수호 인장'])assert.ok(ui.includes(label));
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
