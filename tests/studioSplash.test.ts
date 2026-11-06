import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';


const expectedDurationMs=6000;
const video=readFileSync(new URL('../public/assets/studio1524/splash.mp4',import.meta.url));


test('startup ships the selected six-second portrait cinematic',()=>{
  const movie=video.indexOf(Buffer.from('mvhd'));
  assert.ok(movie>=4,'the intro must be a playable MP4 movie');
  const version=video[movie+4];
  const timescale=video.readUInt32BE(movie+(version===1?24:16));
  const duration=version===1?Number(video.readBigUInt64BE(movie+28)):video.readUInt32BE(movie+20);
  assert.equal(duration/timescale*1000,expectedDurationMs,'the complete selected intro must be included');


  const track=video.indexOf(Buffer.from('tkhd'));
  assert.ok(track>=4,'the intro must include a video track');
  const end=track-4+video.readUInt32BE(track-4);
  assert.equal(video.readUInt32BE(end-8)/65536,1080);
  assert.equal(video.readUInt32BE(end-4)/65536,2304);
});


test('startup safety timeout leaves loading time before the complete intro and remains bounded',()=>{
  const source=readFileSync(new URL('../src/components/splash/Studio1524Splash.tsx',import.meta.url),'utf8');
  const wait=Number(source.match(/const MAX_WAIT_MS\s*=\s*(\d+)/)?.[1]);
  assert.ok(wait>=expectedDurationMs+2000,'the safety timeout must not cut the selected six-second intro short');
  assert.ok(wait<=12000,'a failed video must not block game entry indefinitely');
});

test('startup has no skip button and still exits automatically',()=>{
  const source=readFileSync(new URL('../src/components/splash/Studio1524Splash.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/<button|studio1524-splash__skip|건너뛰기/);
  assert.match(source,/onEnded=\{finish\}/);
  assert.match(source,/onError=\{finish\}/);
  assert.match(source,/setTimeout\(finish,MAX_WAIT_MS\)/);
});


test('startup uses the new STUDIO 1524 branding consistently',()=>{
  const splash=readFileSync(new URL('../src/components/splash/Studio1524Splash.tsx',import.meta.url),'utf8');
  const start=readFileSync(new URL('../src/components/intro/StartScreen.tsx',import.meta.url),'utf8');
  assert.match(splash,/assets\/studio1524\/splash\.mp4/);
  assert.match(splash,/STUDIO 1524/);
  assert.match(start,/STUDIO 1524/);
  assert.doesNotMatch(start,/STUDIO 0322/);
});

test('STUDIO 1524 intro plays once per app session, not again after OAuth reload',()=>{
  const source=readFileSync(new URL('../src/components/splash/Studio1524Splash.tsx',import.meta.url),'utf8');
  const key=source.match(/^const SPLASH_SESSION_KEY=.*;$/m)?.[0];
  const functionSource=source.match(/function shouldPlayIntro\(\):boolean \{[\s\S]*?\n\}/)?.[0];
  assert.ok(key,'splash needs a session-scoped playback marker');
  assert.ok(functionSource,'splash playback decision must be testable');

  const seen=new Map<string,string>();
  const fakeWindow={
    location:{search:''},
    matchMedia:()=>({matches:false}),
    sessionStorage:{
      getItem:(name:string)=>seen.get(name)??null,
      setItem:(name:string,value:string)=>{seen.set(name,value);},
    },
  };
  const evaluate=()=>runInNewContext(key+'\n'+functionSource.replace('():boolean','()')+'\nshouldPlayIntro()',{
    window:fakeWindow,URLSearchParams,
  }) as boolean;
  assert.equal(evaluate(),true,'new app session plays the logo');
  assert.equal(evaluate(),false,'OAuth return/reload must not replay the logo');
  fakeWindow.location.search='?skipSplash=1';
  assert.equal(evaluate(),false,'existing skip flag still suppresses the logo');
  seen.clear();fakeWindow.location.search='';
  assert.equal(evaluate(),true,'new app session plays the logo again');
});
