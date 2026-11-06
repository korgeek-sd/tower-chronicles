import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('guild sections present named tasks without splitting a rendered page at pixel offsets',()=>{
 const read=(name:string)=>readFileSync('src/components/association/'+name,'utf8');
 assert.doesNotMatch(read('AssociationScreen.tsx'),/GuildPages/);
 for(const file of ['GuildBossPanel.tsx','GuildAuctionPanel.tsx','AssociationWarehousePanel.tsx','GuildTerritoryPanel.tsx'])assert.match(read(file),/GuildTask/);
});
