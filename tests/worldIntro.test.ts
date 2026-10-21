import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasSeenWorldIntro,markWorldIntroSeen,WORLD_INTRO_KEY,WORLD_INTRO_PAGES} from '../src/components/intro/worldIntroState';
test('world intro persists only its own completion marker and tolerates blocked storage',()=>{
 const data=new Map<string,string>([['game-save','untouched']]);
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
 assert.equal(hasSeenWorldIntro(storage),false);
 markWorldIntroSeen(storage);
 assert.equal(data.get(WORLD_INTRO_KEY),'1');
 assert.equal(hasSeenWorldIntro(storage),true);
 assert.equal(data.get('game-save'),'untouched');
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(hasSeenWorldIntro(blocked),false);
 assert.doesNotThrow(()=>markWorldIntroSeen(blocked));
});
test('eight approved chapters retain their sequence and use one separate illustration each',()=>{
 assert.equal(WORLD_INTRO_PAGES.length,8);
 assert.deepEqual(WORLD_INTRO_PAGES.map(p=>p.title),['지워진 이름','태어날 때부터 진 빚','불리지 못한 자들','탑은 기억했다','끝나지 않는 삶','귀환자들의 도시','나의 탓이라','당신의 다음 기록']);
 assert.match(WORLD_INTRO_PAGES[0].quote!,/내 책에서 그를 지워/);
 assert.equal(WORLD_INTRO_PAGES[0].citation,'출애굽기 32:33 중 · 개역개정');
 assert.equal(new Set(WORLD_INTRO_PAGES.map(p=>p.image)).size,8);
 for(const p of WORLD_INTRO_PAGES)assert.ok(readFileSync(new URL('../public/'+p.image,import.meta.url)).length>1000);
 assert.match(WORLD_INTRO_PAGES[6].body,/메아쿨파/);
 const ui=readFileSync(new URL('../src/components/intro/GameEntry.tsx',import.meta.url),'utf8');
 assert.match(ui,/markWorldIntroSeen/);assert.match(ui,/건너뛰기/);assert.match(ui,/새 이름을 기록한다/);assert.match(ui,/inert=/);
 assert.doesNotMatch(ui,/page===3|\/ 4/);
});
test('intro uses individual unstretched images and a viewport-sized non-scrolling page',()=>{
 const ui=readFileSync(new URL('../src/components/intro/GameEntry.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/intro/world-intro.css',import.meta.url),'utf8');
 assert.match(ui,/<img/);assert.match(ui,/BASE_URL\+current.image/);
 assert.match(css,/object-fit:cover/);assert.match(css,/height:100dvh/);assert.match(css,/overflow:hidden/);assert.match(css,/safe-area-inset-bottom/);
 assert.doesNotMatch(ui,/world-intro.png|<svg/);
});
test('naming screen describes a new name without changing existing registration rules',()=>{
 const ui=readFileSync(new URL('../src/components/NicknameGate.tsx',import.meta.url),'utf8');
 assert.match(ui,/당신을 무엇이라 부르면 되겠습니까/);assert.match(ui,/이 이름으로 시작한다/);
 assert.match(ui,/validateNickname/);assert.match(ui,/onRegister\(validation.nickname\)/);
});

test('story preview cannot mount gameplay or change the completion marker',()=>{
 const ui=readFileSync(new URL('../src/components/intro/GameEntry.tsx',import.meta.url),'utf8');
 assert.match(ui,/ready&&<div inert=/);
 assert.match(ui,/if\(!preview\)markWorldIntroSeen/);
 assert.match(ui,/const ready=canEnterGame\(signedIn,entered\)/);
});

test('long chapters use compact paragraphs, a shrinking illustration and one row of controls',()=>{
 const ui=readFileSync(new URL('../src/components/intro/GameEntry.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/intro/world-intro.css',import.meta.url),'utf8');
 assert.match(ui,/current.body.split\('\\n\\n'\)/);
 assert.match(css,/flex:1 1 0/);assert.match(css,/min-height:0/);
 assert.match(css,/grid-template-columns:88px 1fr/);assert.match(css,/min-height:44px/);
 assert.doesNotMatch(css,/overflow-y:auto|height:240px|flex:1 0 auto/);
});
