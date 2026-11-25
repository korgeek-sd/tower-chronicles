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
