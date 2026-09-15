import fs from 'node:fs';
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('src/game/types.ts',s=>s.replace('version:12;','version:13;exploration:{unlockedTier:Record<Tower,number>;highestReturned:Record<Tower,number>};'));
edit('src/game/engine/state.ts',s=>s.replace('version:12,','version:13,exploration:{unlockedTier:{ore:1,leather:1,gem:1,kaleon:1},highestReturned:{ore:0,leather:0,gem:0,kaleon:0}},'));
edit('src/game/engine/expedition.ts',s=>s.replace('    commitLoot(n,e.loot);','    commitLoot(n,e.loot);\n    n.exploration.highestReturned[e.tower]=Math.max(n.exploration.highestReturned[e.tower],e.floor);\n    if(e.floor%10===0&&e.bossTracking.bossDefeated)n.exploration.unlockedTier[e.tower]=Math.max(n.exploration.unlockedTier[e.tower],Math.min(5,e.floor/10+1));'));
edit('src/storage/repository.ts',s=>{
 s=s.replace('x.version===12&&validCrafting(x.crafting)&&validV10({...x,version:10},catalog);','x.version===13&&validExploration(x.exploration)&&validCrafting(x.crafting)&&validV10({...x,version:10},catalog);');
 const pos=s.indexOf('export function createRepository');
 s=s.slice(0,pos)+
"const validExploration=(x:unknown)=>obj(x)&&obj(x.unlockedTier)&&obj(x.highestReturned)&&towerIds.every(t=>count((x.unlockedTier as Obj)[t])&&Number((x.unlockedTier as Obj)[t])>=1&&Number((x.unlockedTier as Obj)[t])<=5&&count((x.highestReturned as Obj)[t])&&Number((x.highestReturned as Obj)[t])<=50);\n"+
"export function migrateV12(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {if(!obj(value)||value.version!==12||!validV11({...value,version:11},catalog))throw Error('v12 저장 데이터가 손상되었습니다.');const n=structuredClone(value);const old=n as unknown as GameState;const unlockedTier={ore:1,leather:1,gem:1,kaleon:1},highestReturned={ore:0,leather:0,gem:0,kaleon:0};for(const t of towerIds){const highestTicket=old.tickets[t].reduce((v,q,i)=>q>0?Math.max(v,i+1):v,1);const evidence=Math.max(old.progress[t],highestTicket,old.expedition?.tower===t?old.expedition.floor:1,old.lastExpedition?.tower===t?old.lastExpedition.floor:1);unlockedTier[t]=Math.min(5,Math.ceil(evidence/10));if(old.lastExpedition?.tower===t&&old.lastExpedition.outcome==='returned')highestReturned[t]=old.lastExpedition.floor;}const next={...n,version:13,exploration:{unlockedTier,highestReturned}};if(!validSave(next,catalog))throw Error('탐사 저장 데이터 이전 실패');return next;}\n"+
"export const EXPLORATION_BACKUP_KEY='tower-record-v1-before-exploration-v13';\n"+s.slice(pos);
 // Complete every historical load path before writing a migrated result.
 const load=s.indexOf('    load():GameState');
 s=s.slice(0,load)+s.slice(load).replaceAll('const next=migrateV10(', 'const next=migrateV12(migrateV11(migrateV10(')
   .replace(/(const next=migrateV12\(migrateV11\(migrateV10\([^;]+)\);/g,'$1)));')
   .replace('const next=migrateV11(data,catalog);','const next=migrateV12(migrateV11(data,catalog),catalog);')
   .replace("      if(!validSave(data,catalog))","      if(obj(data)&&data.version===12){const next=migrateV12(data,catalog);if(storage.getItem(EXPLORATION_BACKUP_KEY)===null)storage.setItem(EXPLORATION_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}\n      if(!validSave(data,catalog))");
 return s;
});
