import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {existsSync} from 'node:fs';
import {playerGraphicForJob,playerGraphicFor,assetUrl} from '../src/game/data/graphics.ts';
import {appearanceById} from '../src/game/data/cosmetics.ts';
import {initialState} from '../src/game/engine/state.ts';
import {HomeScreen} from '../src/components/mobile/CoreScreens.tsx';

test('equipped Valkyrie artwork overrides a job illustration without changing the job',()=>{
 const skin=appearanceById('valkyrie');
 assert.equal(skin?.rarity,'A');
 assert.equal(skin?.artStatus,'ready');
 assert.match(skin?.imagePath??'',/^assets\/characters\/appearances\/valkyrie-[0-9a-f]{12}\.webp$/);
 assert.ok(existsSync(new URL('../public/'+skin!.imagePath,import.meta.url)));
 assert.equal(playerGraphicForJob('duelist','valkyrie').image.idle,skin?.imagePath);
 assert.equal(assetUrl(playerGraphicForJob('duelist','valkyrie').image.idle!), './'+skin!.imagePath);
 assert.equal(playerGraphicForJob('duelist','default').image.idle,'assets/characters/jobs/duelist.webp');
 assert.equal(playerGraphicForJob('not_a_job','default').image.idle,playerGraphicFor('default').image.idle);
});

test('hub portrait uses the equipped appearance instead of overriding it with job artwork',()=>{
 const game=initialState();
 game.currentJobId='duelist';
 game.cosmetics.unlockedAppearanceIds.push('valkyrie');
 game.cosmetics.selectedAppearanceId='valkyrie';
 const markup=renderToStaticMarkup(React.createElement(HomeScreen,{game,onMove:()=>{},onOpenJobs:()=>{}}));
 const skin=appearanceById('valkyrie')!;
 assert.ok(markup.includes(assetUrl(skin.imagePath!)));
 assert.match(markup,/alt="현재 캐릭터 외형"/);
 assert.ok(!markup.includes('src="./assets/characters/jobs/duelist.webp"'));
});

test('nickname-side portrait follows the equipped cosmetic, including the default skin',()=>{
 const game=initialState();
 game.currentJobId='duelist';
 const renderPortrait=()=>{
  const html=renderToStaticMarkup(React.createElement(HomeScreen,{game,nickname:'테스트 모험가',onMove:()=>{},onOpenJobs:()=>{}}));
  const match=html.match(/<button[^>]*class="tc-camp-v2-portrait[^"]*"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(match,'Hub portrait button should exist');
  return {html,portrait:match[1]};
 };
 const starter=appearanceById('default')!;
 const initial=renderPortrait();
 assert.ok(initial.portrait.includes('src="'+assetUrl(starter.imagePath!)+'"'),'Default equipped appearance must be shown next to the nickname');
 assert.ok(!initial.portrait.includes('assets/characters/jobs/duelist.webp'),'Job art must not replace the nickname portrait');
 assert.ok(initial.html.includes('src="'+assetUrl('assets/characters/jobs/duelist.webp')+'"'),'Village character job art must remain unchanged when default skin is equipped');
 game.cosmetics.unlockedAppearanceIds.push('valkyrie');
 game.cosmetics.selectedAppearanceId='valkyrie';
 assert.ok(renderPortrait().portrait.includes('src="'+assetUrl(appearanceById('valkyrie')!.imagePath!)+'"'),'Equipping a new skin updates the nickname portrait');
 game.cosmetics.selectedAppearanceId='default';
 assert.ok(renderPortrait().portrait.includes('src="'+assetUrl(starter.imagePath!)+'"'),'Re-equipping the starter skin restores its portrait');
});
