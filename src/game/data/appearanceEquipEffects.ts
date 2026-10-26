import type {AppearanceRarity} from './cosmetics';
import {APPEARANCE_LEVEL_MULTIPLIER,APPEARANCE_MAX_LEVEL} from './appearanceProgress';

/**
 * Effect catalog: 16 equip-only bonuses for the ONE equipped appearance.
 *
 * Appearance IDs are assigned in appearanceEquipAssignments.ts; online battle
 * results and loot use server-owned ownership, rarity and level from Supabase.
 *
 * Rarity bases are used by both guest calculations and mirrored server SQL. The level multipliers
 * reuse the already-defined appearance Lv.1–5 progression.
 */
export type AppearanceEquipEffectUnit='percent'|'percentage_point'|'flat_mp'|'relative_percent';
export type AppearanceEquipEffectScope='combat'|'hunting_rewards';

export interface AppearanceEquipEffectSpec {
 readonly label:string;
 readonly unit:AppearanceEquipEffectUnit;
 readonly scope:AppearanceEquipEffectScope;
 readonly rarityBase:Readonly<Record<AppearanceRarity,number>>;
 readonly description:string;
}

/**
 * "percentage_point" is an additive change to a chance/multiplier (e.g. 5%p).
 * "relative_percent" multiplies an existing probability; it never adds points.
 */
export const APPEARANCE_EQUIP_EFFECTS={
 attack:{
  label:'공격력 증가',unit:'percent',scope:'combat',
  rarityBase:{C:1,B:2,A:3,SR:4,SSR:5},
  description:'착용 중 공격력 증가. 기존 장비·능력치 계산에 곱하는 비율.',
 },
 defense:{
  label:'방어력 증가',unit:'percent',scope:'combat',
  rarityBase:{C:2,B:4,A:6,SR:8,SSR:10},
  description:'착용 중 방어력 증가.',
 },
 max_hp:{
  label:'최대 HP 증가',unit:'percent',scope:'combat',
  rarityBase:{C:2,B:4,A:6,SR:8,SSR:10},
  description:'착용 중 최대 HP 증가. 현재 HP 보정 방식은 추후 전투 연동 시 결정.',
 },
 max_mp:{
  label:'최대 MP 증가',unit:'flat_mp',scope:'combat',
  rarityBase:{C:10,B:20,A:30,SR:40,SSR:50},
  description:'최대 MP 정수 가산. 일반 사냥·길드 보스의 MP와 원정 고유 자원은 별도 처리.',
 },
 crit_chance:{
  label:'치명타 확률 증가',unit:'percentage_point',scope:'combat',
  rarityBase:{C:1,B:2,A:3,SR:4,SSR:5},
  description:'기존 치명타 확률에 %p 가산. 서버 상한 준수.',
 },
 crit_damage:{
  label:'치명타 피해 증가',unit:'percentage_point',scope:'combat',
  rarityBase:{C:4,B:8,A:12,SR:16,SSR:20},
  description:'치명타 피해 배율에 %p 가산.',
 },
 armor_penetration:{
  label:'방어 관통률 증가',unit:'percentage_point',scope:'combat',
  rarityBase:{C:1,B:2,A:3,SR:4,SSR:5},
  description:'기존 방어 관통률에 %p 가산. 서버 상한 준수.',
 },
 skill_damage:{
  label:'스킬 피해 증가',unit:'percent',scope:'combat',
  rarityBase:{C:1,B:2,A:3,SR:5,SSR:7},
  description:'피해를 주는 공격 스킬에만 적용. 기본 공격과 회복·보호막 스킬에는 미적용.',
 },
 mp_cost_reduction:{
  label:'MP 소모량 감소',unit:'percent',scope:'combat',
  rarityBase:{C:2,B:3,A:4,SR:6,SSR:8},
  description:'MP 소모량을 비율로 줄임. 0MP 스킬에는 효과 없음.',
 },
 skill_activation:{
  label:'스킬 발동 확률 증가',unit:'percentage_point',scope:'combat',
  rarityBase:{C:0.5,B:1,A:1.5,SR:2,SSR:3},
  description:'기존 스킬 발동 확률에 %p 가산. 발동 확률 100% 상한 준수.',
 },
 hp_recovery:{
  label:'HP 회복량 증가',unit:'percent',scope:'combat',
  rarityBase:{C:3,B:6,A:9,SR:12,SSR:15},
  description:'자신의 HP 회복 스킬로 회복하는 양 증가. 포션 적용 여부는 별도 결정.',
 },
 shield_generation:{
  label:'보호막 생성량 증가',unit:'percent',scope:'combat',
  rarityBase:{C:3,B:6,A:9,SR:12,SSR:15},
  description:'자신의 보호막 생성 스킬로 만드는 보호막 증가.',
 },
 dot_damage:{
  label:'지속 피해 증가',unit:'percent',scope:'combat',
  rarityBase:{C:3,B:6,A:9,SR:12,SSR:15},
  description:'자신이 적에게 거는 출혈·중독·화상 피해만 증가.',
 },
 hunting_exp:{
  label:'획득 경험치 증가',unit:'percent',scope:'hunting_rewards',
  rarityBase:{C:1,B:2,A:3,SR:4,SSR:5},
  description:'일반 사냥 승리 시 경험치 증가. 패배·다른 경험치 원천에는 미적용.',
 },
 hunting_silver:{
  label:'사냥 실버 획득 증가',unit:'percent',scope:'hunting_rewards',
  rarityBase:{C:1,B:2,A:3,SR:4,SSR:5},
  description:'일반 사냥 승리 시 실버 보상 증가. 거래·이자·판매에는 미적용. 길드 세금 기준은 추후 결정.',
 },
 hunting_equipment_drop:{
  label:'사냥 장비 획득 확률 증가',unit:'relative_percent',scope:'hunting_rewards',
  rarityBase:{C:2,B:4,A:6,SR:8,SSR:10},
  description:'장비 등급별 기본 획득 확률에 동일 배율을 곱함. 1%에 +10% 적용 시 1.1%이지 11%가 아님. 승리 시에만 적용.',
 },
} as const satisfies Record<string,AppearanceEquipEffectSpec>;

export type AppearanceEquipEffectId=keyof typeof APPEARANCE_EQUIP_EFFECTS;
export const APPEARANCE_EQUIP_EFFECT_IDS=Object.keys(APPEARANCE_EQUIP_EFFECTS) as AppearanceEquipEffectId[];

/** Numeric bonus for a single equipped appearance at the given rarity/level. */
export function appearanceEquipEffectValue(id:AppearanceEquipEffectId,rarity:AppearanceRarity,level:number):number {
 if(!Number.isInteger(level)||level<1||level>APPEARANCE_MAX_LEVEL)return 0;
 const def=APPEARANCE_EQUIP_EFFECTS[id] as AppearanceEquipEffectSpec;
 const amount=def.rarityBase[rarity]*APPEARANCE_LEVEL_MULTIPLIER[level];
 return def.unit==='flat_mp'?Math.round(amount):Math.round(amount*100)/100;
}

export function formatAppearanceEquipEffect(id:AppearanceEquipEffectId,rarity:AppearanceRarity,level:number):string {
 const def=APPEARANCE_EQUIP_EFFECTS[id];
 const amount=appearanceEquipEffectValue(id,rarity,level);
 const sign=id==='mp_cost_reduction'?'-':'+';
 const suffix=def.unit==='flat_mp'?' MP':def.unit==='percentage_point'?'%p':'%';
 return def.label+' '+sign+amount+suffix+(def.unit==='relative_percent'?' (기존 확률 대비)':'');
}
