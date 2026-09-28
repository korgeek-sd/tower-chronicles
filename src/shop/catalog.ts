export type GoldShopPurchaseState='billing_not_connected';

export interface GoldShopPackage{
  sku:string;
  kind:'gold';
  gold:number;
  priceKrw:number;
  purchaseState:GoldShopPurchaseState;
}

export const GOLD_SHOP_PACKAGES:readonly GoldShopPackage[]=[
  {sku:'gold_1000',kind:'gold',gold:1000,priceKrw:1500,purchaseState:'billing_not_connected'},
  {sku:'gold_3100',kind:'gold',gold:3100,priceKrw:4500,purchaseState:'billing_not_connected'},
  {sku:'gold_7000',kind:'gold',gold:7000,priceKrw:9900,purchaseState:'billing_not_connected'},
  {sku:'gold_13800',kind:'gold',gold:13800,priceKrw:19000,purchaseState:'billing_not_connected'},
  {sku:'gold_24500',kind:'gold',gold:24500,priceKrw:33000,purchaseState:'billing_not_connected'},
  {sku:'gold_42000',kind:'gold',gold:42000,priceKrw:55000,purchaseState:'billing_not_connected'},
];

export const getGoldPackageBySku=(sku:string):GoldShopPackage|null=>
  GOLD_SHOP_PACKAGES.find(item=>item.sku===sku)??null;

export const formatKrw=(value:number)=>`${value.toLocaleString('ko-KR')}원`;
