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
test('four pages lead from original sin to the player without declaring religious mysteries true',()=>{
 assert.equal(WORLD_INTRO_PAGES.length,4);
 assert.match(WORLD_INTRO_PAGES[0].body,/교회는/);
 assert.match(WORLD_INTRO_PAGES[2].body,/당신 역시/);
 assert.match(WORLD_INTRO_PAGES[3].body,/기록을 남길/);
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/<GameEntry initialError=\{authStartupError\}><App\/><\/GameEntry>/);
 const ui=readFileSync(new URL('../src/components/intro/GameEntry.tsx',import.meta.url),'utf8');
 assert.match(ui,/markWorldIntroSeen/);
 assert.match(ui,/건너뛰기/);
 assert.match(ui,/탑에 들어가기/);
 assert.match(ui,/inert=/);
});
test('intro artwork preserves its source aspect ratio and clips each atlas page',()=>{
 const ui=readFileSync(new URL('../src/components/intro/GameEntry.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/intro/world-intro.css',import.meta.url),'utf8');
 assert.match(ui,/viewBox="0 0 384 1024"/);
 assert.match(ui,/preserveAspectRatio="xMidYMid meet"/);
 assert.match(ui,/clipPath="url\(#world-intro-art-clip\)"/);
 assert.doesNotMatch(css,/background-size:400% 100%/);
});
