/** Display-only catalog. Ownership and books come from saved state; this does not grant skills. */
export const GRADES=['C','B','A','S','SR','SSR'] as const;
export type TreeWeapon='sword'|'bow'|'staff'|'any';
export type TreeType='active'|'passive';
export interface TreeSkill {id:string;name:string;grade:typeof GRADES[number];family:string;familyName:string;weapon:TreeWeapon;type:TreeType;mp:number;power:string;chance:number;effect:string;icon:string}
const skills:TreeSkill[]=[];
const dm=[0,25,45,75,115,170],sm=[15,30,55,90,135,200],chance=[100,90,92,94,96,98],sc=[85,88,91,94,97,100];
function add(family:string,familyName:string,weapon:TreeWeapon,names:string[],mp:number[],power:number[],effects:string[],options:{type?:TreeType;chance?:number[];unit?:string;icon?:string}={}){GRADES.forEach((grade,i)=>skills.push({id:family+'_'+grade.toLowerCase(),name:names[i],grade,family,familyName,weapon,type:options.type??'active',mp:mp[i]??0,power:String(power[i])+(options.unit??'%'),chance:options.chance?.[i]??100,effect:effects[i]??effects[0],icon:options.icon??(weapon==='any'?'skills':weapon)}));}
add('sword_strike','참격','sword',['보급검 베기','강철 베기','파쇄 베기','성문 가르기','귀환자의 참격','종언의 참격'],dm,[75,130,165,205,250,300],['단일 대상 공격','단일 대상 공격','방어 관통 5%','방어 관통 10%','방어 관통 15%','방어 관통 20%'],{chance});
add('sword_wound','출혈 · 흡혈','sword',['상처 내기','상처 베기','흡혈격','피의 회수','붉은 귀환','불멸의 혈검'],sm,[70,105,135,170,210,255],['출혈 8% · 3턴','출혈 10% · 흡혈 5%','출혈 12% · 흡혈 7%','출혈 15% · 흡혈 10%','출혈 18% · 흡혈 12%','출혈 22% · 흡혈 15%'],{chance:sc});
add('bow_shot','관통 사격','bow',['경비대 사격','정밀 사격','관통 화살','갑옷 꿰뚫기','운명의 관통','마지막 별'],dm,[70,125,155,190,230,275],['명중 +5%p','명중 +8%p','방어 관통 5%','방어 관통 10%','방어 관통 15%','방어 관통 20% · 보호막 무시 15%'],{chance});
add('bow_volley','연사 · 중독','bow',['두 발 사격','독촉 연사','맹독 연사','사냥꾼의 연격','독비','검은 별의 연사'],sm,[80,120,150,185,225,270],['2회 공격 · 위력은 합계','2회 공격 · 중독 8%','2회 공격 · 중독 10%','3회 공격 · 중독 12%','3회 공격 · 중독 15%','4회 공격 · 중독 18%'],{chance:sc});
add('staff_flame','화염 · 화상','staff',['마력탄','불씨','화염구','화염 폭발','잿빛 심판','원소의 종말'],dm,[70,120,150,185,225,270],['단일 대상 공격','화상 10% · 3턴','화상 12% · 3턴','화상 15% · 3턴','화상 18% · 3턴','화상 22% · 3턴'],{chance});
add('staff_rift','방어 약화','staff',['균열탄','마력 균열','공허의 창','결계 파쇄','심연의 균열','심연 붕괴'],sm,[70,110,145,185,230,280],[3,5,8,11,15,20].map(n=>`방어력 -${n}% · 3턴`),{chance:[90,92,94,96,98,100]});
add('shield','보호막','any',['버티기','수호막','수호 결계','귀환의 결계','별빛 성역','불가침의 성역'],[10,20,35,55,80,110],[6,9,13,18,24,31],['최대 HP 비례 보호막 · 3턴 · 대기 4턴'],{icon:'defense'});
add('heal','회복','any',['응급 처치','회복의 숨','재생의 숨','생명의 회수','귀환의 축복','귀환의 기적'],[20,35,55,80,110,150],[6,10,15,21,28,36],['최대 HP 비례 회복 · 대기 4턴'],{icon:'health'});
add('restore','MP 회복','any',['정신 집중','마력 수집','마력 회수','공허의 호흡','심연의 샘','무한의 각인'],[],[25,40,60,85,115,150],['고정 MP 회복 · 대기 3턴'],{unit:' MP',icon:'potions'});
add('prepare','다음 공격 강화','any',['집중','전투 집중','약점 포착','결전 준비','승리의 각인','종결의 각인'],[10,20,35,55,80,110],[10,15,22,30,40,50],['다음 공격 피해 증가 · 유지 3턴 · 대기 3턴'],{icon:'skills'});
add('sword_mastery','검술 숙련','sword',['검술 기초','검술 숙련','검의 잔향','검의 의지','귀환검의 계승','종언검의 주인'],[],[3,5,7,9,12,15],['검 스킬 피해 증가'],{type:'passive'});
add('bow_mastery','사격 숙련','bow',['사격 기초','사격 숙련','약점 조준','사냥의 눈','추적자의 통찰','별을 꿰뚫는 눈'],[],[0,2,4,6,9,12],['활 스킬 피해 증가 · 명중 보정'],{type:'passive'});
add('staff_mastery','마력 숙련','staff',['마력 기초','마력 숙련','원소 잔재','마력 순환','심연의 지식','원소의 지배자'],[],[3,5,7,9,12,15],['스태프 스킬 피해 증가'],{type:'passive'});
skills.push({id:'return_oath_ssr',name:'귀환자의 맹세',grade:'SSR',family:'return_oath',familyName:'생존',weapon:'any',type:'passive',mp:0,power:'15%',chance:100,effect:'최대 HP +15% · 전투당 한 번 치명 피해를 받으면 HP 1로 생존하고 보호막 획득',icon:'defense'},{id:'sixth_mark_ssr',name:'여섯 번째 각인',grade:'SSR',family:'sixth_mark',familyName:'순환',weapon:'any',type:'passive',mp:0,power:'15%',chance:100,effect:'액티브 6회 사용마다 MP 80 회복 · 다음 공격 피해 +15%',icon:'skills'});
export const SKILL_TREE_CATALOG:readonly TreeSkill[]=skills;
