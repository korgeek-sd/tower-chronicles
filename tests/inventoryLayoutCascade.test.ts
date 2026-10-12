import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
// Components import their CSS before main imports mobile-game.css.
const css=['../src/components/inventory/inventory.css','../src/components/inventory/iron-inventory.css','../src/mobile-game.css'].map(p=>readFileSync(new URL(p,import.meta.url),'utf8')).join('\n');
function computed(classes:string[],property:string){let value='',priority=-1;postcss.parse(css).walkRules(rule=>{if(rule.parent?.type==='atrule')return;for(const selector of rule.selector.split(',')){if(/:|\[/.test(selector))continue;const required=[...selector.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);if(!required.length||!required.every(c=>classes.includes(c)))continue;rule.walkDecls(property,d=>{if(required.length>=priority){priority=required.length;value=d.value;}});}});return value;}
test('loadout reserves sufficient height for touch button, vitals and three equipment rows',()=>{const outer=computed(['tc-unified-inventory','tc-inventory-v081'],'grid-template-rows');assert.match(outer,/minmax\(244px,/);const inner=computed(['tc-unified-inventory','tc-inventory-v081','tc-loadout-renewed'],'grid-template-rows');assert.match(inner,/^44px 32px/);});
test('upgrade indicator keeps its green color, clear arrow size and separate corner after global styles',()=>{const classes=['tc-unified-inventory','tc-inventory-v081','tc-storage-item-compact','tc-storage-icon','tc-equipment-upgrade'];assert.equal(computed(classes,'color'),'#8bd47c');assert.equal(computed(classes,'font-size'),'20px');assert.equal(computed(classes,'right'),'auto');assert.equal(computed(classes,'left'),'0');});

test("pager reserves its full touch height and small item rows may shrink",()=>{const base=["tc-unified-inventory","tc-inventory-v081","tc-storage-board","tc-pager"];assert.equal(computed(base,"height"),"44px");assert.equal(computed(["tc-unified-inventory","tc-inventory-v081","tc-storage-grid","tc-storage-item","tc-storage-item-compact"],"min-height"),"0");});

test('metal skin keeps equipment markers in separate corners after the global cascade',()=>{
 const base=['tc-iron-inventory','tc-unified-inventory','tc-inventory-v081','tc-storage-item-compact'];
 const equipped=[...base,'tc-storage-equipped-tag'],upgrade=[...base,'tc-storage-icon','tc-equipment-upgrade'],level=[...base,'tc-storage-enhance'];
 assert.equal(computed(equipped,'top'),'1px');assert.equal(computed(equipped,'bottom'),'auto');
 assert.equal(computed(upgrade,'left'),'0');assert.equal(computed(upgrade,'bottom'),'0');
 assert.equal(computed(level,'left'),'auto');assert.equal(computed(level,'right'),'1px');
 for(const [grade,color] of Object.entries({common:'#aaa69b',uncommon:'#79ad83',rare:'#7da8cb',heroic:'#ad8ac5',legendary:'#d3ad63'})){
  assert.equal(computed([...base,'tc-storage-grid','tc-storage-item','grade-'+grade],'--slot-rarity'),color);
 }
});
