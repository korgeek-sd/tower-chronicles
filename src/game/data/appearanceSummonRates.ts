/** Published independent-draw appearance rarity weights, in basis points. */
export const APPEARANCE_SUMMON_RATES = [
 {rarity:'C',basisPoints:6000},
 {rarity:'B',basisPoints:3000},
 {rarity:'A',basisPoints:800},
 {rarity:'SR',basisPoints:180},
 {rarity:'SSR',basisPoints:20},
] as const;
export const APPEARANCE_SUMMON_RATE_TOTAL = APPEARANCE_SUMMON_RATES.reduce((sum,rate)=>sum+rate.basisPoints,0);
