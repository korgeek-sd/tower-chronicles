import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('storage separates summary, scroll-free item rows, policy and collection action',()=>{
 for(const name of ['MarketScreen','ServerMarketScreen']){
  const s=readFileSync(new URL('../src/components/market/'+name+'.tsx',import.meta.url),'utf8');
  assert.match(s,/tc-market-storage-note/);assert.match(s,/tc-market-storage-claim/);
  assert.match(s,/onClick=\{onOpenMail\}/);assert.match(s,/수령할 자산이 없습니다/);
 }
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/<MarketScreen[^\n]*onOpenMail=\{\(\)=>setMailOpen\(true\)\}/);
});
