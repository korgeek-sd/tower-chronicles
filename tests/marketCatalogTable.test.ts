import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('both market screens expose the reference four-category searchable price table',()=>{
 for(const name of ['MarketScreen','ServerMarketScreen']){
 const s=readFileSync(new URL('../src/components/market/'+name+'.tsx',import.meta.url),'utf8');
 assert.match(s,/<MarketCatalogTable/);
 assert.match(s,/placeholder="아이템 검색"/);
 assert.match(s,/\['consumables','소모품'\]/);
 assert.doesNotMatch(s,/\['skillbooks','스킬북'\]/);
 }
});
import {sortCatalogQuotes,catalogPageSize,type CatalogQuote} from '../src/components/market/MarketCatalogTable';
test('quote sorting keeps unavailable prices last in either direction and does not mutate input',()=>{
 const rows=[{id:'a',ask:30,bid:10},{id:'b',ask:null,bid:50},{id:'c',ask:20,bid:null}] as CatalogQuote[];
 assert.deepEqual(sortCatalogQuotes(rows,'ask',false).map(r=>r.id),['c','a','b']);
 assert.deepEqual(sortCatalogQuotes(rows,'ask',true).map(r=>r.id),['a','c','b']);
 assert.deepEqual(sortCatalogQuotes(rows,'bid',true).map(r=>r.id),['b','a','c']);
 assert.deepEqual(rows.map(r=>r.id),['a','b','c']);
});
test('short and tall layouts reserve readable rows and cap at seven',()=>{
 assert.equal(catalogPageSize(280),5);assert.equal(catalogPageSize(392),7);assert.equal(catalogPageSize(180),3);assert.equal(catalogPageSize(900),7);
});
