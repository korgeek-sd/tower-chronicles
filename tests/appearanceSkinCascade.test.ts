import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';

const css=['../src/components/mobile/cosmetics-catalog.css','../src/components/mobile/iron-catalog.css','../src/mobile-game.css'].map(p=>readFileSync(new URL(p,import.meta.url),'utf8')).join('\n');
function computed(classes:string[],property:string,width:number,height:number){
 let value='',priority=-1;
 postcss.parse(css).walkRules(rule=>{
  for(let parent=rule.parent;parent;parent=parent.parent){
   if(parent.type!=='atrule')continue;
   if(parent.name!=='media')return;
   for(const match of parent.params.matchAll(/(max|min)-(width|height):\s*(\d+)px/g)){
    const actual=match[2]==='width'?width:height,limit=Number(match[3]);
    if(match[1]==='max'?actual>limit:actual<limit)return;
   }
  }
  for(const selector of rule.selector.split(',')){
   if(/:|\[/.test(selector))continue;
   const required=[...selector.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);
   if(!required.length||!required.every(c=>classes.includes(c)))continue;
   rule.walkDecls(property,d=>{if(required.length>=priority){priority=required.length;value=d.value;}});
  }
 });return value;
}
test('appearance search spans the available row on narrow and wide layouts',()=>{
 for(const width of [320,360,390,520])assert.equal(computed(['tc-iron-catalog-screen','tc-collection-tools','single'],'grid-template-columns',width,640),'minmax(0,1fr)');
});
test('collection dialogs stay pinned to the visible viewport while the catalogue scrolls',()=>{
 for(const height of [590,640,844])assert.equal(computed(['tc-iron-catalog-screen','tc-collection-modal-backdrop'],'position',320,height),'fixed');
});
test('collection detail reserves its content height instead of collapsing requirements under the actions',()=>{
 for(const width of [320,360,390,520])for(const height of [590,640,740,844]){
  const detail=['tc-iron-catalog-screen','tc-collection-detail'];
  assert.equal(computed(detail,'min-height',width,height),'max-content');
  assert.equal(computed(detail,'grid-template-rows',width,height),'auto auto auto');
  assert.equal(computed(['tc-iron-catalog-screen','tc-cosmetics-catalog'],'overflow-y',width,height),'auto');
 }
});
