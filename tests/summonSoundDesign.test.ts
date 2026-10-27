import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_SUMMON_SOUND_PREFERENCES,SUMMON_TAP_PRESETS,SUMMON_REVEAL_PRESETS,readSummonSoundPreferences,saveSummonSoundPreferences} from '../src/components/appearance/ssrSound.ts';
test('stone tap intensity escalates without accessing SSR or SR rank',()=>{
 assert.equal(SUMMON_TAP_PRESETS.length,3);
 assert.ok(SUMMON_TAP_PRESETS[0].crack<SUMMON_TAP_PRESETS[1].crack);
 assert.ok(SUMMON_TAP_PRESETS[1].crack<SUMMON_TAP_PRESETS[2].crack);
 assert.ok(SUMMON_TAP_PRESETS[2].duration>SUMMON_TAP_PRESETS[0].duration);
 assert.equal(Object.keys(SUMMON_TAP_PRESETS[0]).includes('rarity'),false);
});
test('SR magic shimmer and SSR cathedral bell have distinct pitch and duration',()=>{
 assert.ok(SUMMON_REVEAL_PRESETS.SSR.duration>SUMMON_REVEAL_PRESETS.SR.duration);
 assert.ok(SUMMON_REVEAL_PRESETS.SSR.root<SUMMON_REVEAL_PRESETS.SR.root);
 assert.ok(SUMMON_REVEAL_PRESETS.SSR.tones.length>SUMMON_REVEAL_PRESETS.SR.tones.length);
});
test('summon effects have preferences independent from the single existing BGM',()=>{
 assert.equal(DEFAULT_SUMMON_SOUND_PREFERENCES.enabled,true);
 assert.ok(DEFAULT_SUMMON_SOUND_PREFERENCES.volume>0);
 assert.deepEqual(readSummonSoundPreferences(),DEFAULT_SUMMON_SOUND_PREFERENCES);
 assert.equal(saveSummonSoundPreferences({enabled:false,volume:0}),false); // Node has no localStorage; browser still applies.
 assert.deepEqual(readSummonSoundPreferences(),DEFAULT_SUMMON_SOUND_PREFERENCES);
});
test('confirmed results and three-tap SR/SSR presentation invoke the sounds on the right stage',()=>{
 const reveal=readFileSync('src/components/appearance/SSRReveal.tsx','utf8');
 assert.match(reveal,/playSealImpact\(next\)/);
 assert.match(reveal,/playSummonRarityReveal\(props.draw.rarity\)/);
 assert.match(reveal,/SEAL_RARITY_REVEAL_DELAY_MS\+80/);
 assert.match(reveal,/stop.current\(\)/);
 const summon=readFileSync('src/components/appearance/AppearanceSummonScreen.tsx','utf8');
 assert.match(summon,/playSummonRequest\(rolls\)/);
 const result=readFileSync('src/components/appearance/AppearanceSummonResultView.tsx','utf8');
 assert.match(result,/queue.length>0/);
 assert.match(result,/playSummonOrdinaryResult\(grade\)/);
 const settings=readFileSync('src/components/SettingsDialog.tsx','utf8');
 assert.match(settings,/SSR 효과음 미리 듣기/);
 assert.match(settings,/소환 효과음 음량/);
});
