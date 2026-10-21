export const WORLD_INTRO_KEY='tower-world-intro-v1';
type IntroStorage=Pick<Storage,'getItem'|'setItem'>;
export function hasSeenWorldIntro(storage:IntroStorage):boolean{
 try{return storage.getItem(WORLD_INTRO_KEY)==='1';}catch{return false;}
}
export function markWorldIntroSeen(storage:IntroStorage):void{
 try{storage.setItem(WORLD_INTRO_KEY,'1');}catch{/* Presentation storage must never prevent entry. */}
}
type WorldIntroPage={chapter:string;title:string;body:string;image:string;quote?:string;citation?:string};
export const WORLD_INTRO_PAGES:readonly WorldIntroPage[]=[
 {chapter:'01',title:'지워진 이름',body:'',image:'assets/intro/story/chapter-01.webp',quote:'누구든지 내게 범죄하면\n내가 내 책에서 그를 지워 버리리라.',citation:'출애굽기 32:33 중 · 개역개정'},
 {chapter:'02',title:'태어날 때부터 진 빚',image:'assets/intro/story/chapter-02.webp',body:'교단은 가르쳤다.\n\n모든 인간은 죄를 물려받아 태어나며,\n살아가는 동안 그 빚을 갚아야 한다고.\n\n죽은 자는 책에 기록된 이름으로 불려 나와\n자신의 삶을 심판받는다고.'},
 {chapter:'03',title:'불리지 못한 자들',image:'assets/intro/story/chapter-03.webp',body:'그러나 책에서 이름이 지워진 자는\n죽어서도 불려 나갈 수 없었다.\n\n그들의 얼굴은 기억에서 흐려지고,\n그들이 남긴 이름은 읽을 수 없게 되었다.\n\n누군가를 사랑했다는 사실도,\n누군가에게 미움받았다는 사실도.\n\n세상은 주인을 잃은 기억을\n조금씩 다른 이야기로 바꾸었다.'},
 {chapter:'04',title:'탑은 기억했다',image:'assets/intro/story/chapter-04.webp',body:'그들이 지킨 집은 남았다.\n그들이 만든 검도 남았다.\n\n그러나 누구도\n그 집을 지킨 자와 검을 만든 자를 기억하지 못했다.\n\n세상이 잊은 삶들은 탑으로 흘러들었다.\n\n영웅과 괴물, 왕과 죄인.\n지워진 자들의 삶이 그곳에 남아 있었다.\n\n『탑의 기록』이라 불리는 외경이었다.'},
 {chapter:'05',title:'끝나지 않는 삶',image:'assets/intro/story/chapter-05.webp',body:'지워진 자들은\n탑의 기록을 따라 다시 눈을 떴다.\n\n죽어도 끝맺을 수 없는 삶.\n돌아와도 기다리는 이가 없는 세상.\n\n사람들은 그들을 귀환자라 불렀다.\n\n당신 역시 그들 가운데 하나다.'},
 {chapter:'06',title:'귀환자들의 도시',image:'assets/intro/story/chapter-06.webp',body:'탑 앞에는 돌아온 자들이 모여들었다.\n\n서로에게 새 이름을 붙이고,\n잠들 곳과 검을 고칠 대장간을 세웠다.\n\n검과 갑옷에는 값이 매겨졌고,\n잃어버릴 재산에는 보험이 붙었다.\n\n죽음을 끝내지 못하는 이들에게도\n내일을 살아갈 은화는 필요했다.'},
 {chapter:'07',title:'나의 탓이라',image:'assets/intro/story/chapter-07.webp',body:'교단은 탑의 기록을 금했다.\n\n지워진 이름을 다시 읽는 것은\n신의 심판을 거스르는 일이라 했다.\n\n그러나 그 기록을 지키는 자들이 있었다.\n\n그들은 묻지 않았다.\n당신이 결백한가를.\n\n대신 물었다.\n당신에게 무슨 일이 있었는가를.\n\n메아쿨파.\n그들은 그렇게 자신을 불렀다.'},
 {chapter:'08',title:'당신의 다음 기록',image:'assets/intro/story/chapter-08.webp',body:'당신이 어떤 삶을 살았는지,\n누가 당신의 이름을 지웠는지는 알 수 없다.\n\n탑에는 그 답이 남아 있을지도 모른다.\n\n잃은 이름을 찾아도 좋다.\n은화와 힘을 구해도 좋다.\n다른 귀환자의 곁에 머물러도 좋다.\n\n이제 무엇을 남길지는\n당신이 정한다.'},
];
