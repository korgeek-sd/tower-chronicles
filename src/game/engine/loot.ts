import {skillBookFor} from '../skills/books';
﻿import type {ExpeditionLoot, GameState} from '../types';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADES} from '../data/equipment';
import {SKILLS,TOWERS,towerIds,CONFIG} from '../data/config';

export const emptyLoot = (): ExpeditionLoot => ({
  silver: 0,
  materials: Object.fromEntries(towerIds.map(t => [t, Array(5).fill(0)])) as ExpeditionLoot['materials'],
  tickets: Object.fromEntries(towerIds.map(t => [t, Array(CONFIG.maxFloor).fill(0)])) as ExpeditionLoot['tickets'],
  skillBooks: {},
  items: {},
  equipment: [],
});
export const sumCounts = (counts: Record<string, number>) => Object.values(counts).reduce((sum, n) => sum + n, 0);
export const lootTotals = (loot: ExpeditionLoot) => ({
  materials: towerIds.reduce((sum, t) => sum + loot.materials[t].reduce((a,b) => a+b,0), 0),
  tickets: towerIds.reduce((sum, t) => sum + loot.tickets[t].reduce((a,b) => a+b,0), 0),
  skillBooks: sumCounts(loot.skillBooks),
  equipment: loot.equipment?.length??0,
});
export const bookName = (id: string) => skillBookFor(id)?.name ?? ((SKILLS.find(s => s.id === id)?.name || id) + ' 스킬북');
/** Labels are shared by live loot, immutable result receipts, and logs. */
export function lootLines(loot: ExpeditionLoot): string[] {
  const lines: string[] = [];
  if (loot.silver) lines.push('Silver ' + loot.silver.toLocaleString());
  for (const t of towerIds) {
    loot.materials[t].forEach((n,i) => { if(n) lines.push((i+1)+'티어 '+TOWERS[t].material+' ×'+n); });
    loot.tickets[t].forEach((n,i) => { if(n) lines.push(TOWERS[t].name+' '+(i+1)+'층 입장권 ×'+n); });
  }
  for (const [id,n] of Object.entries(loot.skillBooks)) if(n) lines.push(bookName(id)+' ×'+n);
  for (const [id,n] of Object.entries(loot.items)) if(n) lines.push(id+' ×'+n);
  for (const item of loot.equipment??[]) {
    const gradeIndex=EQUIPMENT_GRADES.indexOf(item.grade);
    const gradeName=['일반','고급','희귀','영웅','전설'][gradeIndex]??item.grade;
    lines.push(gradeName+' '+EQUIPMENT_DEFINITIONS[item.kind].name+' +'+item.enhancement);
  }
  return lines;
}
/** Called only by expedition settlement, never directly by combat rewards. */
export function commitLoot(state: GameState, loot: ExpeditionLoot): void {
  state.silver += loot.silver;
  for (const t of towerIds) {
    loot.materials[t].forEach((n,i) => state.materials[t][i] += n);
    loot.tickets[t].forEach((n,i) => {
      state.tickets[t][i] += n;
      if(n) state.progress[t] = Math.max(state.progress[t], i+1);
    });
  }
  for (const [id,n] of Object.entries(loot.skillBooks)) state.skillBooks[id] = (state.skillBooks[id] || 0) + n;
  for (const [id,n] of Object.entries(loot.items)) state.lootItems[id] = (state.lootItems[id] || 0) + n;
  state.equipmentItems??=[];
  const owned=new Set(state.equipmentItems.map(item=>item.id));
  for (const item of loot.equipment??[]) if(!owned.has(item.id)){state.equipmentItems.push(structuredClone(item));owned.add(item.id);}
}
