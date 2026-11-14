import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryGridLayout} from '../src/components/inventory/inventoryGridLayout';
for(const width of [280,320,360,480])for(const height of [120,320,600]){
 test(`inventory slots stay square and no larger than detail icon at ${width}x${height}`,()=>{
  const layout=inventoryGridLayout(width,height);
  assert.equal(layout.columns,6);
  assert.ok(layout.slotSize<=52);
  assert.ok(layout.slotSize*6+6*5<=width);
  assert.ok(layout.rows*layout.slotSize+(layout.rows-1)*6<=height);
  assert.equal(layout.pageSize,layout.rows*6);
  assert.equal(inventoryGridLayout(width,height+100).slotSize,layout.slotSize);
 });
}
