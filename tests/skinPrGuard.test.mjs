import test from 'node:test';
import assert from 'node:assert/strict';
import {checkCatalogChange} from '../scripts/skin-pr-guard.mjs';

const first="{id:'knight',name:'기사',rarity:'B',imagePath:'assets/characters/appearances/knight-aaaaaaaaaaaa.webp',tradeable:false}";
const second="{id:'valkyrie',name:'발키리',rarity:'A',imagePath:'assets/characters/appearances/valkyrie-cccccccccccc.webp',tradeable:false}";
const catalog=(entries)=>"const starter={id:'default'};\nexport const APPEARANCES=[starter,\n"+entries+"\n];\n";

test('isolated artwork replacement preserves all other entries',()=>{
 const before=catalog(first+','+second);
 const after=catalog(first.replace('aaaaaaaaaaaa','bbbbbbbbbbbb')+','+second);
 assert.deepEqual(checkCatalogChange(before,after),{
  id:'knight',imagePath:'assets/characters/appearances/knight-bbbbbbbbbbbb.webp',hash:'bbbbbbbbbbbb',isNew:false
 });
});
test('adding an unrelated skin does not change existing entries',()=>{
 const result=checkCatalogChange(catalog(first),catalog(first+','+second));
 assert.equal(result.id,'valkyrie');
 assert.equal(result.isNew,true);
});
test('updating two entries together is rejected',()=>{
 assert.throws(()=>checkCatalogChange(catalog(first+','+second),catalog(
  first.replace('aaaaaaaaaaaa','bbbbbbbbbbbb')+','+
  second.replace('cccccccccccc','dddddddddddd')
 )),/exactly one/);
});
test('modifying unrelated cosmetic metadata is rejected',()=>{
 assert.throws(()=>checkCatalogChange(catalog(first),catalog(first.replace("name:'기사'","name:'새 기사'").replace('aaaaaaaaaaaa','bbbbbbbbbbbb'))),/metadata changed/);
});
test('removing other skins or changing code outside array is rejected',()=>{
 assert.throws(()=>checkCatalogChange(catalog(first+','+second),catalog(first)),/removed or renamed/);
 assert.throws(()=>checkCatalogChange(catalog(first),catalog(first.replace('aaaaaaaaaaaa','bbbbbbbbbbbb'))+'export const compromised=true;'),/outside/);
});

test('executable expressions inside proposed catalog entries are rejected',()=>{
 const unsafe=second.replace('tradeable:false',"tradeable:(()=>{throw new Error('bad')})()");
 assert.throws(()=>checkCatalogChange(catalog(first),catalog(first+','+unsafe)),/executable expression/);
});
