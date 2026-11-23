/**
 * 신규 원정단 이름 규칙. 기존 원정단 이름은 이 정책을 통해 수정하지 않는다.
 * Supabase migration association_name_policy와 목록/검증 방식을 동기화한다.
 */
export const ASSOCIATION_NAME_MIN=2;
export const ASSOCIATION_NAME_MAX=6;
export const RESERVED_ASSOCIATION_NAMES=["탑기록원","노바르평의회","은저울상회","네공방연맹","청동마차상단"] as const;
export const ASSOCIATION_NAME_PARTIAL_BLOCKLIST=["씨발","시발","씨팔","시팔","씨바","시바","병신","븅신","빙신","개새끼","개쉐끼","좆","좃","존나","졸라","지랄","염병","섹스","야동","포르노","자위","성매매","보지","자지","후장","딸딸이","강간","성폭행","근친","한남","김치녀","틀딱","맘충","짱깨","쪽바리","운영자","관리자","개발자","게임마스터","고객센터","공식운영","운영팀","현금거래","계정판매","대리육성","fuck","fuk","fck","f0ck","shit","bitch","cunt","asshole","porn","porno","hentai","rape","rapist","nazi","gm","admin","rmt","sellacc","sibal","shibal","ssibal","s1bal","b1tch"] as const;
export const ASSOCIATION_NAME_EXACT_BLOCKLIST=["미친놈","미친년","개자식","쓰레기","나치","히틀러","카지노","도박","불법도박","sex","nude","xxx","dick","pussy","slut","whore","kkk","mod","staff","dev","system","casino","cheat","hack"] as const;

export const associationNameKey=(value:string)=>
 value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/gu,'');

export function associationNameError(value:string):string|null{
 if(value.length<ASSOCIATION_NAME_MIN||value.length>ASSOCIATION_NAME_MAX)
  return '원정단 이름은 2~6글자로 입력해 주세요.';
 if(!/^[가-힣A-Za-z0-9]{2,6}$/u.test(value))
  return '완성형 한글·영문·숫자만 사용 가능합니다. 자음·모음·공백·특수문자는 사용할 수 없습니다.';
 if(/^[0-9]+$/.test(value))
  return '숫자로만 구성된 이름은 사용할 수 없습니다.';
 if(/(.)\1{3,}/u.test(value))
  return '같은 글자를 4번 이상 연속으로 사용할 수 없습니다.';
 const normalized=associationNameKey(value);
 if(RESERVED_ASSOCIATION_NAMES.some(word=>normalized===associationNameKey(word))||
    ASSOCIATION_NAME_EXACT_BLOCKLIST.some(word=>normalized===word)||
    ASSOCIATION_NAME_PARTIAL_BLOCKLIST.some(word=>normalized.includes(word)))
  return '금지어 또는 운영자 사칭 표현이 포함된 이름은 사용할 수 없습니다.';
 return null;
}
