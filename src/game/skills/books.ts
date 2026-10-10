import {SKILL_TREE_CATALOG} from './catalog';
export const SKILL_BOOKS=SKILL_TREE_CATALOG.map(skill=>({itemId:'skillbook:'+skill.id,skillId:skill.id,name:skill.name+' 스킬북',grade:skill.grade,type:skill.type,weapon:skill.weapon,description:`${skill.name} 습득에 1권 필요합니다. 남은 스킬북은 강화 재료로 보관합니다.`}));
export const skillBookFor=(id:string)=>SKILL_BOOKS.find(book=>book.skillId===id)??null;
