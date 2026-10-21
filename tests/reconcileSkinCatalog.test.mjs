import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileSkinCatalog} from '../scripts/reconcile-skin-catalog.mjs';
import {checkCatalogChange} from '../scripts/skin-pr-guard.mjs';

const knight="{id:'knight',name:'기사',rarity:'B',imagePath:'assets/characters/appearances/knight-aaaaaaaaaaaa.webp',tradeable:false}";
const valkyrie="{id:'valkyrie',name:'발키리',rarity:'A',imagePath:'assets/characters/appearances/valkyrie-cccccccccccc.webp',tradeable:false}";
const teddy="{id:'teddy',name:'테디',rarity:'B',imagePath:'assets/characters/appearances/teddy-eeeeeeeeeeee.webp',tradeable:false}";
const catalog=entries=>"const starter={id:'default'};\nexport const APPEARANCES=[starter,\n"+entries+"\n];\n";

test('reconcile preserves another session added skin while adding the proposed skin',()=>{
 const base=catalog(knight);
 const main=catalog(knight+','+valkyrie);
 const pr=catalog(knight+','+teddy);
 const merged=reconcileSkinCatalog(base,main,pr);
 assert.match(merged,/id:'valkyrie'/);
 assert.match(merged,/id:'teddy'/);
 assert.equal((merged.match(/id:'knight'/g)||[]).length,1);
 assert.equal(checkCatalogChange(main,merged).id,'teddy');
});
test('reconcile preserves other replacement while replaying a different replacement',()=>{
 const base=catalog(knight+','+valkyrie);
 const main=catalog(knight+','+valkyrie.replace('cccccccccccc','dddddddddddd'));
 const pr=catalog(knight.replace('aaaaaaaaaaaa','bbbbbbbbbbbb')+','+valkyrie);
 const merged=reconcileSkinCatalog(base,main,pr);
 assert.match(merged,/knight-bbbbbbbbbbbb/);
 assert.match(merged,/valkyrie-dddddddddddd/);
});
test('reconcile rejects simultaneous conflicting updates to one appearance ID',()=>{
 const base=catalog(knight);
 const main=catalog(knight.replace('aaaaaaaaaaaa','bbbbbbbbbbbb'));
 const pr=catalog(knight.replace('aaaaaaaaaaaa','cccccccccccc'));
 assert.throws(()=>reconcileSkinCatalog(base,main,pr),/human decision required/);
});
test('reconcile is idempotent after identical art is committed',()=>{
 const base=catalog(knight);
 const result=catalog(knight.replace('aaaaaaaaaaaa','bbbbbbbbbbbb'));
 assert.equal(reconcileSkinCatalog(base,result,result),result);
});
