import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/mobile/NovarShopScreen.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('GOLD SHOP UI 01: shop renders six-package catalog and purchase confirmation',()=>{
 assert.match(screen,/GOLD_SHOP_PACKAGES/);
 assert.match(screen,/getGoldPackageBySku/);
 assert.match(screen,/tc-shop-grid/);
 assert.match(screen,/tc-shop-confirm/);
 assert.match(screen,/결제 준비중/);
});

test('GOLD SHOP UI 02: paid shop never exposes gameplay item categories',()=>{
 const start=screen.indexOf('export function ShopScreen');
 const end=screen.length;
 const shop=screen.slice(start,end);
 for(const forbidden of ['소모품','장비 상자','회복물약','외형 상품','Silver 상품'])assert.equal(shop.includes(forbidden),false,forbidden);
});

test('GOLD SHOP UI 03: mobile shop uses a viewport-contained two-column grid and press feedback',()=>{
 assert.match(css,/\.tc-shop-grid\{[^}]*grid-template-columns:repeat\(2,1fr\)/s);
 assert.match(css,/\.tc-shop-card[^}]*touch-action:manipulation/s);
 assert.match(css,/\.tc-shop-card:not\(:disabled\):active\{[^}]*transform:/s);
});

test('BOTTOM NAV SHOP: shop replaces the battle tab while the hunt route and purchase safeguards remain intact',()=>{
 const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const atlas=readFileSync(new URL('../src/components/mobile/HubIcon.tsx',import.meta.url),'utf8');
 const navSection=entry.slice(entry.indexOf('const nav:'),entry.indexOf('function App(){'));
 assert.ok(navSection.includes("['shop','상점']"));
 assert.ok(!navSection.includes("['hunt','전투']"));
 assert.match(entry,/<HubIcon name=\{p\}/);
 assert.match(entry,/\{page==='shop'&&<ShopScreen/);
 assert.match(entry,/\{page==='hunt'&&<HuntingPage/);
 assert.match(atlas,/shop:5/);
 assert.match(screen,/결제 준비중/);
});

test('NOVAR SHOP 04: all four tabs and the three cash package plans are reachable',()=>{
 const start=screen.indexOf('export function ShopScreen');
 const end=screen.length;
 const shop=screen.slice(start,end);
 for(const key of ["'recommend'","'gold'","'package'","'attendance'"])assert.ok(screen.includes(key),key);
 for(const name of ['신규 모험가 패키지','주간 원정 지원','복귀 모험가 패키지','30일 출석 보상'])assert.ok(screen.includes(name),name);
 assert.match(shop,/setTab\('attendance'\)/);
 assert.match(shop,/setTab\('gold'\)/);
 assert.match(shop,/setSelectedSku\(item.sku\)/);
 assert.match(shop,/previewPackage\(p.id\)/);
 assert.match(shop,/type="button"[^>]*disabled>결제 준비중/);
});

test('NOVAR SHOP 05: attendance previews 30 dates without client-side reward credits',()=>{
 const start=screen.indexOf('export function ShopScreen');
 const end=screen.length;
 const shop=screen.slice(start,end);
 assert.match(shop,/Array.from\(\{length:30\}/);
 assert.match(shop,/외형 소환권 30장/);
 assert.match(shop,/외형 소환권 60장/);
 assert.match(shop,/90,000 S/);
 assert.match(shop,/600 G/);
 assert.match(shop,/4,900원/);
 assert.doesNotMatch(shop,/setGame\(/);
 assert.match(shop,/claimFreeAttendance\(lease,userId\)/);
 assert.match(shop,/getFreeAttendanceStatus\(lease,userId\)/);
 assert.match(shop,/오늘 무료 받기/);
 assert.match(shop,/attendance\.todayClaimed/);
 assert.match(shop,/유료 추가\(준비 중\)/);
 const style=readFileSync(new URL('../src/components/mobile/novar-shop.css',import.meta.url),'utf8');
 assert.match(style,/\.tc-novar-shop\{/);
 assert.match(style,/\.tc-novar-shop-view\{/);
 assert.match(style,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(style,/@media\(max-height:700px\)/);
});

test('FREE ATTENDANCE: Supabase RPC uses the active lease, server-calculated rewards, and cloud record',()=>{
 const client=readFileSync(new URL('../src/online/freeAttendance.ts',import.meta.url),'utf8');
 const migration=readFileSync(new URL('../supabase/migrations/20261107163408_free_attendance_30_day_server_claim.sql',import.meta.url),'utf8');
 assert.match(client,/get_free_attendance_status/);
 assert.match(client,/claim_free_attendance/);
 assert.match(client,/p_lease_id:lease\.leaseId/);
 assert.match(client,/getFreshSession/);
 assert.match(client,/getDeviceId/);
 assert.match(migration,/private\.require_active_game_session/);
 assert.match(migration,new RegExp("time zone 'Asia/Seoul'","i"));
 assert.match(migration,/primary key \(user_id, cycle_number, day_number\)/);
 assert.match(migration,/unique \(user_id, claimed_on\)/);
 assert.match(migration,/v_day % 5 = 0 then 5 else 0/);
 assert.match(migration,/private\.appearance_ticket_wallets/);
 assert.match(migration,/private\.persist_market_economy_to_save\(v_user\)/);
 assert.match(migration,/revoke all on function public\.claim_free_attendance/);
 assert.match(migration,/grant execute on function public\.claim_free_attendance/);
 assert.doesNotMatch(migration,/p_reward|p_silver|p_ticket_quantity/);
 assert.match(screen,/setAttendance\(result\.status\)/);
 assert.match(entryOrEmpty(),/onRecord=\{record=>\{/);
 function entryOrEmpty(){
   return readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 }
});

test('GOLD SHOP UI 06: every price tier has a distinct approved pixel chest asset',()=>{
 const art='assets/ui/shop/gold_chest_tiers.png';
 assert.match(screen,/GOLD_CHEST_TIERS_ART/);
 assert.match(screen,/GOLD_CHEST_TIER_NAMES/);
 assert.match(screen,/GOLD_SHOP_PACKAGES\.map\(\(item,index\)=>/);
 assert.match(screen,/data-tier=\{index\+1\}/);
 assert.match(screen,/goldChestStyle\(index\+1\)/);
 assert.match(screen,/goldChestStyle\(GOLD_SHOP_PACKAGES\.findIndex/);
 assert.equal((screen.match(/GOLD_CHEST_TIERS_ART/g)||[]).length,2);
 const paths=readFileSync(new URL('../public/'+art,import.meta.url));
 assert.equal(paths.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(paths.readUInt32BE(16),384);
 assert.equal(paths.readUInt32BE(20),64);
 const tierCss=readFileSync(new URL('../src/components/mobile/novar-shop.css',import.meta.url),'utf8');
 assert.match(tierCss,/background-size:600% 100%/);
});
