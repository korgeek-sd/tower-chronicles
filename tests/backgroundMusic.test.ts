import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTowerTheme,THEME_SECONDS,THEME_TICKS_PER_SECOND} from '../src/audio/towerThemeScore.ts';
import {DEFAULT_MUSIC_PREFERENCES} from '../src/audio/backgroundMusic.ts';
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
