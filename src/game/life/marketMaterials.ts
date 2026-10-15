/** Current server-authoritative life materials, no retired tower resources. */
export const MARKET_LIFE_MATERIAL_IDS=['herb','pepper','potato','wheat','stone'] as const;
export type MarketLifeMaterial=typeof MARKET_LIFE_MATERIAL_IDS[number];
export const MARKET_LIFE_MATERIAL_NAMES:Record<MarketLifeMaterial,string>={herb:'약초',pepper:'고추',potato:'감자',wheat:'밀',stone:'분해석'};
export const marketLifeItemId=(id:MarketLifeMaterial)=>'material:life:'+id;
