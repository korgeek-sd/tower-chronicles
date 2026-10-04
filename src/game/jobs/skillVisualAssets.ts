export const SKILL_VISUAL_ASSETS:Readonly<Record<string,string>>={};

export function skillVisualAssetFor(skillId:string|null|undefined):string|null{
 return skillId?SKILL_VISUAL_ASSETS[skillId]??null:null;
}
