import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {boxReveal,boxStatRows,boxOpeningFrame,BOX_FRAME_WIDTH,BOX_FRAME_HEIGHT,BOX_FRAME_COUNT} from '../src/components/inventory/boxPresentation';
import type {EquipmentItem} from '../src/game/types';
const item=(grade:EquipmentItem['grade']):EquipmentItem=>({id:grade,kind:'association_supply_iron_sword',grade,enhancement:0});
test('opening does not predict a grade before a receipt arrives',()=>{
 assert.equal(boxReveal([]),null);
});
test('batch reveal uses the highest actual reward without mutating receipt order',()=>{
 const rewards=[item('rare'),item('legendary'),item('common')];
 assert.equal(boxReveal(rewards)?.grade,'legendary');
 assert.equal(boxReveal(rewards)!.duration,5200);
 assert.deepEqual(rewards.map(i=>i.grade),['rare','legendary','common']);
 assert.equal(boxReveal(rewards,true)?.duration,0);
});
test('result stats come from real equipment and exclude fictional level requirements',()=>{
 const rows=boxStatRows(item('common'));
 assert.ok(rows.some(row=>row.label==='공격력'&&row.value==='+10'));
 assert.ok(rows.some(row=>row.label==='방어력'&&row.value==='+4'));
 assert.ok(!rows.some(row=>row.label.includes('레벨')));
});

test('opening has a substantial wind-up, a suspense hold, and a separate reveal beat',()=>{
 const common=boxReveal([item('common')])!,legendary=boxReveal([item('legendary')])!;
 assert.equal(common.duration,3100);
 assert.ok(legendary.duration>common.duration);
 for(const grade of ['common','uncommon','rare','heroic','legendary'] as const){
  const reveal=boxReveal([item(grade)])!;
  assert.ok(reveal.chargeAt>=650);
  assert.ok(reveal.holdAt>reveal.chargeAt);
  assert.ok(reveal.burstAt-reveal.holdAt>=350);
  assert.ok(reveal.duration-reveal.burstAt>=450);
 }
});

test('GPU box renderer preserves strict production CSP and surfaces fallback status',()=>{
 const fx=readFileSync('src/components/inventory/PixiBoxStage.tsx','utf8');
 const ui=readFileSync('src/components/inventory/AdventurerBoxDialog.tsx','utf8');
 assert.match(fx,/await import\('pixi\.js\/unsafe-eval'\)/);
 assert.match(fx,/Texture\.from\(chestImage\)/);
 assert.doesNotMatch(fx,/Assets\.load/);
 assert.match(fx,/onStatus\('gpu'\)/);
 assert.match(fx,/onStatus\('fallback'\)/);
 assert.match(ui,/data-box-renderer=\{renderer\}/);
 assert.match(ui,/PixiJS · GPU/);
});

test('opening atlas includes eight equally sized frames and a held final pose',()=>{
 const png=readFileSync('public/assets/ui/shop/adventurer_box_opening_v3.png');
 assert.equal(png.readUInt32BE(16),BOX_FRAME_WIDTH*BOX_FRAME_COUNT);
 assert.equal(png.readUInt32BE(20),BOX_FRAME_HEIGHT);
 assert.equal(boxOpeningFrame(-1),0);
 assert.deepEqual([0,90,180,245,315,395,490,590,900].map(boxOpeningFrame),[0,1,2,3,4,5,6,7,7]);
 const fx=readFileSync('src/components/inventory/PixiBoxStage.tsx','utf8');
 const style=readFileSync('src/components/inventory/adventurer-box.css','utf8');
 assert.match(fx,/chestSprite\.texture=frames/);
 assert.match(style,/adventurer_box_opening_v3\.png/);
 assert.doesNotMatch(fx,/lid\.rotation/);
});

test('chest visuals use the clean transparent icon; opening uses Pixi instead of legacy CSS effects',()=>{
 const icon=readFileSync('public/assets/ui/shop/adventurer_equipment_box.png');
 assert.equal(icon.readUInt32BE(16),96);assert.equal(icon.readUInt32BE(20),96);
 const css=readFileSync('src/components/inventory/adventurer-box.css','utf8');
 const dialog=readFileSync('src/components/inventory/AdventurerBoxDialog.tsx','utf8');
 assert.doesNotMatch(css,/@keyframes|animation\s*:/);
 assert.doesNotMatch(css+dialog,/tc-box-(rays|sparks|seam|shockwave|lid)/);
});
