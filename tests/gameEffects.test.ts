import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EFFECT_SOUND_PROFILES,cuesForFeedback,DEFAULT_EFFECT_SOUND_SETTINGS,readEffectSoundSettings,saveEffectSoundSettings} from '../src/audio/gameEffects.ts';
test('phase one and association seal synthesize distinct cues without downloaded assets',()=>{
 const names=Object.keys(EFFECT_SOUND_PROFILES);
 assert.deepEqual(names,['ui.click','ui.confirm','ui.error','hunt.start','hunt.victory','hunt.defeat','loot.common','loot.rare','player.level-up','seal.cast','seal.step-1','seal.step-2','seal.step-3','seal.reset']);
 for(const cue of Object.values(EFFECT_SOUND_PROFILES))assert.ok(cue.length>0&&cue.every(x=>x.duration>0&&x.gain>0));
 assert.ok(EFFECT_SOUND_PROFILES['loot.rare'].length>EFFECT_SOUND_PROFILES['loot.common'].length);
});
test('only confirmed hunt outcomes play victory, defeat, equipment and level rewards',()=>{
 assert.deepEqual(cuesForFeedback('hunt.start'),[{name:'hunt.start',delay:0}]);
 assert.deepEqual(cuesForFeedback('hunt.result',{outcome:'defeat',grade:'legendary',leveledUp:true}),[{name:'hunt.defeat',delay:0}]);
 assert.deepEqual(cuesForFeedback('hunt.result',{outcome:'victory'}),[{name:'hunt.victory',delay:0}]);
 assert.deepEqual(cuesForFeedback('hunt.result',{outcome:'victory',grade:'common'}).map(x=>x.name),['hunt.victory','loot.common']);
 assert.deepEqual(cuesForFeedback('hunt.result',{outcome:'victory',grade:'legendary',leveledUp:true}).map(x=>x.name),['hunt.victory','loot.rare','player.level-up']);
 assert.deepEqual(cuesForFeedback('hunt.result',{outcome:'victory',grade:'heroic'}).map(x=>x.name),['hunt.victory','loot.rare']);
});
test('game effect volume and mute are separate from BGM and summon preferences',()=>{
 assert.deepEqual(readEffectSoundSettings(),DEFAULT_EFFECT_SOUND_SETTINGS);
 assert.equal(saveEffectSoundSettings({enabled:false,volume:0}),false); // No localStorage in Node.
 assert.deepEqual(readEffectSoundSettings(),DEFAULT_EFFECT_SOUND_SETTINGS);
});
test('existing GameFeel event bridge handles sound, global UI click, and accurate level calculation',()=>{
 const provider=readFileSync('src/gameFeel/react/GameFeelProvider.tsx','utf8');
 assert.match(provider,/useEffect\(\(\)=>mountInterfaceSounds\(\),\[\]\)/);
 assert.match(provider,/playGameFeedback\(event,payload\)/);
 const hunt=readFileSync('src/components/hunting/HuntingScreen.tsx','utf8');
 assert.match(hunt,/experienceBeforeHunt\.current=hunting\.experience/);
 assert.match(hunt,/leveledUp:huntingLevel\(hunting\.experience\)>huntingLevel\(experienceBeforeHunt\.current\)/);
 const settings=readFileSync('src/components/SettingsDialog.tsx','utf8');
 assert.match(settings,/게임 효과음 음량/);
 assert.match(settings,/레벨업 효과음 미리 듣기/);
 const audio=readFileSync('src/audio/gameEffects.ts','utf8');
 assert.match(audio,/\.tc-hunt-enter,\.tc-hunt-next/);
 assert.match(audio,/!event\.isTrusted/);
 assert.match(audio,/\:disabled,\[aria-disabled/);
});

test('association seal plays start immediately and server-confirmed stage-specific outcome',()=>{
 assert.deepEqual(cuesForFeedback('seal.roll.start'),[{name:'seal.cast',delay:0}]);
 assert.deepEqual(cuesForFeedback('seal.roll.result',{step:1}),[{name:'seal.step-1',delay:0}]);
 assert.deepEqual(cuesForFeedback('seal.roll.result',{step:2}),[{name:'seal.step-2',delay:0}]);
 assert.deepEqual(cuesForFeedback('seal.roll.result',{step:3}),[{name:'seal.step-3',delay:0}]);
 assert.deepEqual(cuesForFeedback('seal.roll.result',{step:99} as never),[]);
 assert.deepEqual(cuesForFeedback('seal.reset'),[{name:'seal.reset',delay:0}]);
 assert.ok(EFFECT_SOUND_PROFILES['seal.step-3'].length>EFFECT_SOUND_PROFILES['seal.step-1'].length);
 assert.ok(EFFECT_SOUND_PROFILES['seal.step-2'].length>EFFECT_SOUND_PROFILES['seal.step-1'].length);
});
test('seal failure does not play positive result and a canceled reset does not play a success sound',()=>{
 const seal=readFileSync('src/components/seal/SealScreen.tsx','utf8');
 const requestAt=seal.indexOf('const result=await rollOnlineSeal(onlineLease,sealId)');
 const serverStepAt=seal.indexOf('lastResultStep=result.step');
 const successSoundAt=seal.indexOf("feel.play('seal.roll.result',{step:lastResultStep})");
 assert.ok(requestAt>=0&&serverStepAt>requestAt&&successSoundAt>serverStepAt,
  'success sound must follow the server-confirmed final roll step');
 assert.match(seal,/for\(let index=0;index<selectedRolls;index\+\+\)\{/);
 assert.match(seal,/if\(result\.afterLevel>=ASSOCIATION_SEAL_MAX_LEVEL\)break/);
 assert.ok(seal.indexOf('const result=await resetOnlineSeal(onlineLease,sealId)')<seal.indexOf("feel.play('seal.reset')"));
 assert.ok(seal.indexOf("if(!window.confirm(")<seal.indexOf('const result=await resetOnlineSeal(onlineLease,sealId)'));
 const audio=readFileSync('src/audio/gameEffects.ts','utf8');
 assert.match(audio,/\.tc-seal-roll,\.tc-seal-reset,\.tc-seal-audio-preview/);
 const prefs=readFileSync('src/components/SettingsDialog.tsx','utf8');
 assert.match(prefs,/협회 인장 \+3 효과음 미리 듣기/);
});
