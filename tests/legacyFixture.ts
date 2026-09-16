import {towerIds} from '../src/game/data/config.ts';

/**
 * Current fixtures use the v21 10-slot ticket matrix. Historical schemas v1-v20
 * stored 50 slots, so tests that intentionally downgrade a current fixture must
 * restore that historical shape before handing it to an old-schema validator.
 * Production validators stay strict; this helper is test-only.
 */
export function withHistoricalTickets<T>(value:T):T {
 const next:any=structuredClone(value);
 const pad=(tickets:any)=>{
  if(!tickets||typeof tickets!=='object')return;
  for(const tower of towerIds){
   const row=tickets[tower];
   if(Array.isArray(row)&&row.length===10)tickets[tower]=[...row,...Array(40).fill(0)];
  }
 };
 pad(next?.tickets);
 pad(next?.expedition?.loot?.tickets);
 pad(next?.lastExpedition?.loot?.tickets);
 return next as T;
}
