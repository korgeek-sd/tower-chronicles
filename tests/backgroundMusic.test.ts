import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTowerTheme,THEME_SECONDS,THEME_TICKS_PER_SECOND} from '../src/audio/towerThemeScore.ts';
import {DEFAULT_MUSIC_PREFERENCES} from '../src/audio/backgroundMusic.ts';
import {readFileSync} from 'node:fs';
test('original MIDI score is encoded with seven independent instrument layers',()=>{
 const notes=decodeTowerTheme();
 assert.equal(THEME_SECONDS,40);
 assert.equal(THEME_TICKS_PER_SECOND,768);
 assert.equal(notes.length,278);
 assert.deepEqual([...new Set(notes.map(x=>x.instrument))].sort(),[0,1,2,3,4,5,6]);
 assert.ok(notes.every(n=>n.tick>=0&&n.duration>0&&n.pitch>=0&&n.velocity>0&&n.instrument<7));
 assert.ok(notes.every((n,i)=>i===0||n.tick>=notes[i-1].tick));
 assert.ok(notes.every(n=>n.tick+n.duration<=THEME_SECONDS*THEME_TICKS_PER_SECOND));
});
test('background music is enabled by default at a restrained volume',()=>{
 assert.equal(DEFAULT_MUSIC_PREFERENCES.enabled,true);
 assert.ok(DEFAULT_MUSIC_PREFERENCES.volume>0&&DEFAULT_MUSIC_PREFERENCES.volume<.5);
});

test('one background music player mounts on the title, after Studio 1524 splash',()=>{
 const entry=readFileSync(new URL('../src/components/intro/GameEntry.tsx',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(entry,/splashDone&&<BackgroundMusic\/>/);
 assert.doesNotMatch(main,/<BackgroundMusic\/>/);
});
test('title screen tries autoplay and resumes on first gesture if mobile blocks it',()=>{
 const code=readFileSync(new URL('../src/audio/backgroundMusic.ts',import.meta.url),'utf8');
 assert.match(code,/Start with the server-selection title/);
 assert.match(code,/window.addEventListener\('storage',settings\);[\s\S]*?start\(\);/);
 assert.match(code,/context\.state==='suspended'\)void context\.resume\(\)/);
 assert.match(code,/document\.addEventListener\('pointerdown',unlock/);
 assert.match(code,/document\.addEventListener\('keydown',unlock/);
});
