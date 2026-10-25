/** Display-only quote for server-authoritative appearance summons.
 * Always charge and choose ticket usage on Supabase, never the client.
 */
export const APPEARANCE_SUMMON_GOLD_PRICE = Object.freeze({
 single: 300,
 ten: 2700,
});
export const APPEARANCE_SUMMON_TEN_DISCOUNT_PERCENT = 10;

/** Tickets cover one draw each. The ten-draw discount applies to each remaining gold-funded draw. */
export function appearanceSummonPayment(rolls:1|10,tickets:number):{ticketsUsed:number;goldSpent:number}{
 const ticketsUsed=Math.min(rolls,Math.max(0,Math.floor(tickets)));
 const goldPerDraw=rolls===10?APPEARANCE_SUMMON_GOLD_PRICE.ten/10:APPEARANCE_SUMMON_GOLD_PRICE.single;
 return {ticketsUsed,goldSpent:(rolls-ticketsUsed)*goldPerDraw};
}
