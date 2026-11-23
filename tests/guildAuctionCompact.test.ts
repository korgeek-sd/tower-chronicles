import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const panel=readFileSync(new URL('../src/components/association/GuildAuctionPanel.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/components/association/guildAuctionCompact.css',import.meta.url),'utf8');
const screen=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
test('경매장 v4: 헤더 및 탭 순서와 목록 스크롤 구조',()=>{
 const tabs=panel.indexOf('tc-ga-bottom-tabs tc-ga-top-tabs');
 const categories=panel.indexOf('tc-ga-categories');
 const toolbar=panel.indexOf('tc-ga-toolbar');
 const list=panel.indexOf('className="tc-ga-list"');
 const featured=panel.indexOf('className="tc-ga-feature"');
 assert.ok(tabs>=0&&tabs<categories&&categories<toolbar&&toolbar<list&&list<featured);
 assert.match(panel,/tc-guild-auction tc-ga-v2 tc-ga-v3 tc-ga-v4/);
 assert.match(panel,/종료 경매/);
 assert.match(panel,/낙찰 내역 포함/);
});
test('경매장 v4: 모바일 기본 선택창 대신 게임 내 정렬 메뉴를 사용',()=>{
 assert.match(panel,/GameScrollSelect ariaLabel="경매 정렬" compact className="tc-ga-sort-game-select"/);
 for(const label of ['남은 시간순','최고 입찰순','낮은 가격순'])assert.ok(panel.includes(label),label);
 assert.doesNotMatch(panel,/<select[^>]*aria-label="경매 정렬"/);
});
test('경매장 v4: 단일 스크롤 목록과 다크 판타지 간결한 카드',()=>{
 assert.match(styles,/\.tc-ga-v4 \.tc-ga-heading\{/);
 assert.match(styles,/\.tc-ga-v4 \.tc-ga-top-tabs\{/);
 assert.match(styles,/\.tc-ga-v4 \.tc-ga-list\{[\s\S]*?overflow-y:auto!important/);
 assert.match(styles,/\.tc-ga-v4 \.tc-ga-feature\{[\s\S]*?background:linear-gradient/);
 assert.match(screen,/import '\.\/guildAuctionReference\.css';\s*import '\.\/guildAuctionCompact\.css';/);
});
test('경매장 v4: 서버 입찰과 보상, 낙찰, 유찰, 경매 등록 동작 그대로 유지',()=>{
 for(const method of ['bidGuildAuction','claimGuildBossReward','claimGuildAuctionItem',
   'registerGuildAuctionItem','recoverGuildAuctionItem','relistGuildBossAuctionItem','recoverGuildMaterialAuction']){
  assert.ok(panel.includes(method),method);
 }
 assert.match(panel,/setSelectedLotId/);
 assert.match(panel,/validBid/);
 assert.match(panel,/selected\.isMyListing/);
 assert.match(panel,/selected\.canRelist/);
 assert.match(panel,/tc-ga-quick-menu/);
 assert.match(panel,/tc-ga-feature-bid/);
});
