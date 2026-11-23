import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCombatPower} from '../src/game/combatPower.ts';
const base={hp:180,attack:8,defense:3,critChance:.05,critDamage:1.5,armorPenetration:0};
test('전투력 v1: 서버 기본 능력치의 결정론적 점수',()=>{
 assert.equal(calculateCombatPower(base).power,174);
 assert.equal(calculateCombatPower(base,.08).power,188);
});
test('전투력 v1: 기존 능력치 증가 시 감소하지 않는다',()=>{
 const original=calculateCombatPower(base).power;
 for(const [key,value] of Object.entries({hp:200,attack:10,defense:10,critChance:.15,critDamage:1.8,armorPenetration:.15}))
  assert.ok(calculateCombatPower({...base,[key]:value}).power>=original,key);
});
test('전투력 v1: 음수/비정상 입력과 스킬 상한 방어',()=>{
 assert.equal(calculateCombatPower({...base,attack:-100}).power>=0,true);
 assert.equal(calculateCombatPower({...base,critChance:10}).power,calculateCombatPower({...base,critChance:.6}).power);
 assert.equal(calculateCombatPower(base,100).power,calculateCombatPower(base,.2).power);
 assert.equal(calculateCombatPower({...base,hp:Infinity}).power>=0,true);
});
test('전투력 v1: 스킬 장착 보너스는 아이템 중복 보정을 하지 않는다',()=>{
 assert.equal(calculateCombatPower(base,.03).power,Math.floor((8*10*1.025+180*.5*1.03)*1.03));
});
