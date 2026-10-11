import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {appearanceSummonTickets,grantAppearanceSummonTickets} from '../src/game/engine/appearanceSummonTickets';
import {inventoryView} from '../src/game/inventoryView';
import {parseSaveImport,serializeSaveExport,validCosmetics} from '../src/storage/repository';
import {AppearanceSummonScreen} from '../src/components/appearance/AppearanceSummonScreen';
test('summon tickets accumulate separately, persist and never become inventory items',()=>{
 const original=initialState(),before=JSON.stringify(original);
 const game=grantAppearanceSummonTickets(grantAppearanceSummonTickets(original,2),3);
 assert.equal(appearanceSummonTickets(original),0);
 assert.equal(appearanceSummonTickets(game),5);
 assert.equal(JSON.stringify(original),before);
 assert.equal(appearanceSummonTickets(parseSaveImport(serializeSaveExport(game))),5);
 assert.deepEqual(inventoryView(game),inventoryView(original));
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,onList:()=>{}}));
 assert.match(html,/외형 소환권<b>5장<\/b>/);
});
test('old saves default to zero and invalid or overflowing ticket rewards are rejected',()=>{
 const game=initialState();delete game.cosmetics.summonTickets;
 assert.equal(appearanceSummonTickets(game),0);
 assert.ok(validCosmetics(game.cosmetics));
 for(const amount of [-1,0,1.5,NaN,Infinity])assert.throws(()=>grantAppearanceSummonTickets(game,amount));
 for(const amount of [-1,1.5,NaN,Infinity])assert.equal(validCosmetics({...game.cosmetics,summonTickets:amount}),false);
 game.cosmetics.summonTickets=Number.MAX_SAFE_INTEGER;
 assert.throws(()=>grantAppearanceSummonTickets(game,1));
});
