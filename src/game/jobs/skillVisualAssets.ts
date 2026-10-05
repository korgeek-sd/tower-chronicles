export const SKILL_VISUAL_ASSETS:Readonly<Record<string,string>>={
 mercenary_skill_1:'assets/ui/skills/contract_mercenary/mercenary_skill_1.webp',
 mercenary_skill_2:'assets/ui/skills/contract_mercenary/mercenary_skill_2.webp',
 mercenary_skill_3:'assets/ui/skills/contract_mercenary/mercenary_skill_3.webp',
 hunter_skill_1:'assets/ui/skills/hunter/hunter_skill_1.webp',
 hunter_skill_2:'assets/ui/skills/hunter/hunter_skill_2.webp',
 hunter_skill_3:'assets/ui/skills/hunter/hunter_skill_3.webp',
 field_medic_skill_1:'assets/ui/skills/field_medic/field_medic_skill_1.webp',
 field_medic_skill_2:'assets/ui/skills/field_medic/field_medic_skill_2.webp',
 field_medic_skill_3:'assets/ui/skills/field_medic/field_medic_skill_3.webp',
};

export function skillVisualAssetFor(skillId:string|null|undefined):string|null{
 return skillId?SKILL_VISUAL_ASSETS[skillId]??null:null;
}
