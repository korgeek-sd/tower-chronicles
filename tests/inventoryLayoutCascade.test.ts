import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
// Components import their CSS before main imports mobile-game.css.
const css=['../src/components/inventory/inventory.css','../src/mobile-game.css'].map(p=>readFileSync(new URL(p,import.meta.url),'utf8')).join('\n');
function computed(classes:string[],property:string){let value='',priority=-1;postcss.parse(css).walkRules(rule=>{if(rule.parent?.type==='atrule')return;for(const selector of rule.selector.split(',')){if(/:|\[/.test(selector))continue;const required=[...selector.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);if(!required.length||!required.every(c=>classes.includes(c)))continue;rule.walkDecls(property,d=>{if(required.length>=priority){priority=required.length;value=d.value;}});}});return value;}
test('loadout reserves sufficient height for touch button, vitals and three equipment rows',()=>{const outer=computed(['tc-unified-inventory','tc-inventory-v081'],'grid-template-rows');assert.match(outer,/minmax\(244px,/);const inner=computed(['tc-unified-inventory','tc-inventory-v081','tc-loadout-renewed'],'grid-template-rows');assert.match(inner,/^44px 32px/);});
test('upgrade indicator keeps its green color, clear arrow size and separate corner after global styles',()=>{const classes=['tc-unified-inventory','tc-inventory-v081','tc-storage-item-compact','tc-storage-icon','tc-equipment-upgrade'];assert.equal(computed(classes,'color'),'#8bd47c');assert.equal(computed(classes,'font-size'),'20px');assert.equal(computed(classes,'right'),'auto');assert.equal(computed(classes,'left'),'2px');});
