export const WORLD_INTRO_KEY='tower-world-intro-v1';
type IntroStorage=Pick<Storage,'getItem'|'setItem'>;
export function hasSeenWorldIntro(storage:IntroStorage):boolean{
 try{return storage.getItem(WORLD_INTRO_KEY)==='1';}catch{return false;}
}
export function markWorldIntroSeen(storage:IntroStorage):void{
 try{storage.setItem(WORLD_INTRO_KEY,'1');}catch{/* Presentation storage must never prevent entry. */}
}
export const WORLD_INTRO_PAGES=[
 {chapter:'I',title:'최초의 말소',body:'신은 모든 존재에게 이름을 주었다.\n인간은 타인의 이름을 지웠다.\n교회는 이를 최초의 죄라 불렀다.'},
 {chapter:'II',title:'외경, 탑의 기록',body:'영웅과 괴물, 왕과 죄인.\n검게 지워진 얼굴 아래\n그들의 기록은 남아 있었다.'},
 {chapter:'III',title:'무명자',body:'타인의 형상을 빌릴 수 있으나\n자신의 기록은 찾을 수 없는 자.\n당신 역시 그들 중 하나다.'},
 {chapter:'IV',title:'당신의 기록',body:'누군가는 부를 위해.\n누군가는 잃어버린 이름을 위해.\n이제, 당신의 기록을 남길 차례다.'},
] as const;
