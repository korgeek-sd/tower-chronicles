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
