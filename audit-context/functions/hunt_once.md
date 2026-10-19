## `public.hunt_once` in audit-context/evidence/live-functions/public.hunt_once.sql (L1-L261)

**Purpose:** 온라인 즉시 사냥 1회의 전투, 자원 소비, 보상 및 저장 투영을 서버에서 계산한다. UI의 게스트 전투 계산과 온라인 경로는 분리된다 (`src/components/hunting/HuntingPage.tsx` L34-L42). 이 문서는 판정·수정·재현 단계가 아닌 호출 경로 문맥 기록이다.

**Inputs & Assumptions:**
- `p_lease_id`, `p_generation`, `p_client_instance_id`, `p_device_id`: 비신뢰 클라이언트 입력. 서버 사용자 식별은 인자가 아닌 `village_life_user` 반환값이다 (live root L21). 해당 wrapper의 저장소 정의는 모든 null을 거절하고 공통 가드를 호출한다 (`supabase/migrations/20261007163810_village_life.sql` L55-L61). 운영 wrapper도 null 거절 및 같은 공통 가드 위임을 확인했다 (`audit-context/evidence/live-functions/private.village_life_user.sql` L7-L8).
- `p_request_id uuid`: 비신뢰 요청 식별자. 필수 여부 L22, 사용자별 영수증 조회 L32, 지역 일치 검사 L34. UUID 타입 파싱은 PostgreSQL 입력 계층에 의존한다.
- `p_map_id text`: 비신뢰 지역 선택. 정확히 5개 허용값 L23. 보상·몬스터 수치를 클라이언트가 직접 전달하는 인자는 없다 (L1).
- `auth.uid()`/JWT `session_id`, `auth.sessions`, `active_game_sessions`: 공통 가드의 암묵 입력. 실제 운영 가드는 인증 세션의 사용자 소유권 및 활성 lease의 만료·generation·auth session·device·client 일치를 검사하고 행을 잠근다 (`audit-context/evidence/live-functions/private.require_active_game_session.sql` L8-L26).
- 저장된 장착 ID·스킬 목록·스킬 조건은 이전 요청의 영향을 받는 준신뢰 상태. root가 직접 확인하는 것은 자산 resolver 호출 및 습득 스킬 존재 여부다 (L51-L62, L119-L122). 이전 상태를 작성하는 모든 RPC 검증은 이 단일 함수 분석 범위 밖이다.
- 시간은 DB `now()`에서 epoch milliseconds로 계산 (L11), 난수는 서버 `random()` (L40-L46, L134, L151, L232). 암호학적 난수성 보장에 관한 근거는 `nothing found`; 이 단계는 난수 요구 수준을 판정하지 않는다.

**Outputs & Effects:**
- JSON `{state,result,record,replayed,serverNow}`. 영수증 재생은 기존 `r.result`와 현재 상태·저장 레코드를 함께 반환 (L35); 신규는 계산 결과를 반환 (L260).
- `game_saves` → wallet → hunting 순서의 잠금과 생활 상태 refresh (L24-L37). 실제 공통 가드를 통과한다면 앞에 active session 잠금도 있다 (guard L20).
- 생활 포션·음식 차감 (L72-L78, L224-L231), 승리 시 길드 금고·원장·활동 (L234-L249), 장비·재료·silver 보상 (L252-L255), HP/MP·활력·경험치·숙련도 변경 (L257), 영수증 생성 (L258), 저장 이력/리비전 투영 (L259).
- 명시적 네트워크·외부 HTTP 호출은 없다. 함수 내부 중간 커밋이나 예외 흡수 블록은 없다 (L20-L261); 쓰기는 호출 DB 트랜잭션 경계에 속한다. 모든 호출자의 외부 트랜잭션 구성은 별도 확인 항목이다.

---

**Block-by-Block:**

```sql
-- live root L21-L29
u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
-- request/map validation; save FOR UPDATE; economy sync; wallet FOR UPDATE
```
- **What:** 사용자 및 요청 형태를 정하고 저장·지갑 행을 잠근다.
- **Why here:** 영수증 및 계산 전에 동일 사용자의 경제 변경과 경합하는 저장 경계를 잡는다 (L24 주석).
- **Assumes:** wrapper가 공통 가드에 위임한다. 운영 `private.village_life_user.sql` L7-L8에서 확인했다.
- **Establishes:** 요청 ID non-null, 지역 allowlist, 해당 사용자의 저장 및 서버 지갑 존재 (L22-L29).
- **Depended on by:** 아래 전투·보상 쓰기 전부.

```sql
-- live root L30-L38
perform private.refresh_hunting_state(u);
select * into h from private.hunting_states where user_id=u for update;
select * into r from private.hunting_receipts where user_id=u and request_id=p_request_id;
```
- **What:** 사냥 상태를 refresh하고 사용자/request ID 영수증을 확인한다. 영수증이 있으면 다른 map은 거절, 같은 map은 즉시 반환 (L33-L35).
- **Why here:** 새 전투의 생활 소비·활력 검사·난수 처리보다 앞에서 재생을 끝낸다. 단 refresh/economy sync는 재생 전에도 실행된다.
- **Assumes:** 영수증 결과 보존 및 유일성. 저장소 DDL은 `(user_id,request_id)` primary key를 선언 (`supabase/migrations/20261007130000_instant_hunting.sql` L11-L18); 현재 운영 제약 snapshot은 없음.
- **Establishes:** 기존 요청의 원래 결과가 재사용되고 신규 보상 경로에는 진입하지 않음 (L35).
- **Depended on by:** 클라이언트 미확정 요청 재시도.
- 신규 경로만 `refresh_village_life`, strict 생활행 조회, 활성 원정/저장 expedition 부재, 활력≥1 검사를 수행 (L37-L39). expedition JSON이 명시적 null이 아니면 거절한다 (L38).

```sql
-- live root L40-L79
monster:=private.choose_hunting_monster(p_map_id,previous_monster,random());
p:=jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true);
player:=private.combat_equipment_stats(u,p);
```
- **What:** 지역별 silver/XP/재료 설정 후 서버 몬스터를 선택한다. 몬스터 HP/공격/방어는 helper 반환값으로 덮어쓴다 (L40-L48).
- **Why here:** 재생·참가 조건 통과 후에만 난수 전투 입력을 정한다.
- **Assumes:** helper catalog가 적절한 수치와 스킬을 반환. 저장소 monster selector는 map catalog 존재, draw 범위, 이전 몬스터 제외 후보의 존재를 검사 (`supabase/migrations/20261011100000_new_hunting_monsters.sql` L2319-L2330); live helper 일치 여부 미확보.
- **Establishes:** 장착은 저장 ID에서 선택하되 `combat_equipment_stats`가 재해석한다. HP/공격/방어 하한, 치명타율·관통 상하한을 root에서 적용 (L54). 무기값은 덮어쓰기 전 resolver 출력에서 취한다 (L53).
- 저장소 최신 직접 정의는 소유 `market_assets`의 quantity=1 장비만 읽고 슬롯-kind를 대조, 고정 kind/grade catalog로 수치를 계산하며 서버 hunting allocation 및 seal level을 더한다 (`supabase/migrations/20261010130000_hunting_stat_allocation.sql` L22-L55). 통짜 gear 수치를 바로 사용하지 않는다. 현재 운영 resolver 본문은 별도 확보 필요.
- 패시브는 spec 존재·타입·무기 및 learned_catalog_skills 소유를 검사하고 enhancement_level을 서버 행에서 읽는다 (L59-L69). HP 회복 포션, 음식, premium XP 보정, active slots 준비가 뒤따른다 (L71-L79). 운영 premium helper는 `premium_accounts`의 같은 사용자 행과 expires_at>now() 존재 여부를 반환 (`audit-context/evidence/live-functions/private.premium_active.sql` L6).

```sql
-- live root L81-L223
for turn_no in 1..100 loop
 -- status damage, condition/MP/cooldown selection, player/monster actions
end loop;
win:=mhp=0 and hp>0;
```
- **What:** 최대 100턴의 서버 전투. DOT가 먼저 적용되고 사망하면 종료 (L86-L98); 선택 슬롯은 조건 helper, 침묵/지연/쿨다운, 특수 기본 스킬 또는 learned/spec/무기/MP 검사를 거친다 (L100-L126).
- **Why here:** 클라이언트의 outcome/damage를 받지 않고 보상 판정에 필요한 결과를 만든다.
- **Assumes:** `hunting_conditions_match`의 조건 해석은 운영 snapshot으로 확인했다: SQL null이면 true, 배열 외/길이>2는 false, 각 kind의 수치·배수·상태 비교 중 실패하면 false, 전부 통과 시 true (`audit-context/evidence/live-functions/private.hunting_conditions_match.sql` L9-L24). 수치 cast 오류를 흡수하는 분기는 없다 (L13-L25).
- **Establishes:** catalog 액티브는 서버 enhancement·MP 차감·쿨다운·서버 확률 판정 뒤 적용 (L128-L187); 기본 guard/heavy/quick 및 대기 분기 (L188-L204); 몬스터 행동 helper 결과로 damage/heal/effects 갱신, shield와 일회 생존 처리 (L205-L220).
- **Depended on by:** 승리 여부, 남은 HP, 턴 기록, XP/보상 분기. `hunting_damage` 저장소 정의는 방어/관통 clamp와 최소 1 정수 피해 (`supabase/migrations/20261008100000_hunting_six_stats.sql` L2-L6). monster action 저장소 정의는 턴 순서별 skill, 피해, 다양한 상태·회복량, 결과 메시지를 산출 (`supabase/migrations/20261011100000_new_hunting_monsters.sql` L2339-L2383). 운영 helper snapshot은 없음.

```sql
-- live root L224-L260
update private.village_life_players set products=l.products,food_turns=l.food_turns where user_id=u;
-- win-only tax/assets/wallet
update private.hunting_states ...;
insert into private.hunting_receipts(user_id,request_id,map_id,result) ...;
perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');
```
- **What:** 전후 포션 소비, 음식 턴 감소, 승리 드롭 및 길드 분담, 서버 재화·자산·사냥 상태·영수증·저장 투영을 순서대로 기록.
- **Why here:** root의 단일 호출 안에 결과와 보상을 함께 기록한다. 영수증 삽입은 전투/보상 뒤지만 저장·지갑 잠금은 앞서 획득했다 (L25-L31).
- **Assumes:** 드롭 helper의 ID/grade 출력과 서버 economy projection의 정확성. 저장소 drop helper는 roll/kind/map 검증 후 고정 누적 확률 및 새 UUID 생성 (`supabase/migrations/20261010122549_hunting_equipment_drops.sql` L2-L16).
- **Establishes:** 길드 비율은 0..30 clamp, ACTIVE 길드 금고 증가 성공 시 원장/활동, 실패 시 tax=0 (L234-L249). 승리만 자산·silver 증가 (L252-L255); 승패 모두 활력 1 소비, HP/MP 기록 (L257); 영수증 보존 (L258).
- **Depended on by:** 재시도 시 영수증 반환, 다음 사냥의 자원/HP, 거래소 지갑 및 저장 UI. live persist는 서버 projection → 이전 revision 이력 → revision+1/hash 저장 → 지갑 synced revision을 수행 (`audit-context/evidence/live-functions/private.persist_client_payload_with_server_economy.sql` L9-L19).

---

**Cross-Function Dependencies:**
- `village_life_user` (external-source-available, 저장소만): null 거절 후 공통 가드 위임. 공통 가드는 live source available, 성공 전 인증/활성 lease 검사 모두 통과해야 UUID 반환 (위 refs).
- `sync_market_economy_from_latest_save` (저장소 source available): 지갑 존재 시 revision marker만 전진, 최초 지갑 부재 시 저장 payload 재화/장비/재료/티켓/책/기타를 import (`supabase/migrations/20260928023000_equipment_v23_cutover_v0164.sql` L161-L225). **최초 import 입력의 신뢰는 상위 save/bootstrap 경계에 의존**한다. 운영 sync도 같은 최초 import와 기존 지갑 revision-marker 동작이다 (`audit-context/evidence/live-functions/private.sync_market_economy_from_latest_save.sql` L12-L67). 상위 경계 검증 연결은 별도 기록과 결합해야 한다.
- `refresh_hunting_state` (저장소 source available): insert/행 잠금, 300초 회복, 100 이상 bonus vitality 보존, 전투 통계/스탯/MP/생활 상태 조합 (`supabase/migrations/20261011194500_hunting_catalog_combat.sql` L9-L23). replay도 호출한다. 실제 운영 helper 미확보.
- `refresh_village_life` (저장소 source available): 최초 행 보장·잠금·서울 날짜 변경 시 AP reset (`supabase/migrations/20261007163810_village_life.sql` L34-L41). 실패는 root로 전파. 운영 snapshot도 같은 insert/잠금/서울 날짜 AP reset만 수행 (`audit-context/evidence/live-functions/private.refresh_village_life.sql` L8-L11).
- `combat_equipment_stats`, `fixed_equipment_stats`, `association_seal_bonus_json`: 소유 장비 및 고정 catalog·스탯·seal 수치 의존. 고정 catalog는 저장소 `supabase/migrations/20261008142245_fixed_equipment_catalog.sql` L2-L6; seal helper 본문은 이 분석에서 확보하지 않아 open question.
- `hunting_skill_spec` (저장소 source available): 고정 JSON ID 조회, 알 수 없는 ID는 SQL JSON lookup 결과 null (`supabase/migrations/20261011194500_hunting_catalog_combat.sql` L4-L7). root는 null spec 무시. `hunting_conditions_match`, `premium_active`는 운영 source available: 조건 분기 L9-L24 및 premium_accounts 만료 검사 L6를 확인 (각 동명 evidence 파일).
- `choose_hunting_monster`, `hunting_monster_action`, `hunting_damage`, `hunting_equipment_drop`: 위 저장소 정의를 읽음. 하위 monster catalog는 거대한 고정 JSON (`supabase/migrations/20261011100000_new_hunting_monsters.sql`); 모든 개별 몬스터 수치의 게임 규칙 적합성 검증은 수행하지 않음.
- `association_activity` (저장소 source available): 인자로 받은 association/user/event/text를 활동 테이블에 insert하며 별도 권한 검사는 본문에 없음 (`supabase/migrations/20260928083000_server_associations_v0166.sql` L250-L258). root가 ACTIVE membership join에서 guild_id를 공급 (L234-L245).
- `persist_client_payload_with_server_economy` → live `server_authoritative_payload` L14-L26 → live `server_economy_payload` L9-L32: 지갑 silver/gold, 소유 자산 inventory 및 skill/quest 투영으로 JSON을 다시 구성. consumables/jobs/association 투영은 추가 helper와 결합 (`audit-context/evidence/live-functions/private.server_authoritative_payload.sql` L9-L26). 이 하위 helper군의 전체 검증은 다른 함수 기록과 합쳐야 함.
- `cloud_record_json` (저장소 source available): 사용자 save 한 행을 JSON 반환 (`supabase/migrations/20260926022500_server_economy_authority_v0149.sql` L100-L102). 운영 본문 미확보.
- Caller: `HuntingPage`는 사용자별 localStorage pending UUID/map을 요청 전 저장, 미확정 시 같은 map/ID 재시도, 응답 반영 후 삭제 (`src/components/hunting/HuntingPage.tsx` L21-L39, L47). 클라이언트 API는 token 및 lease/device와 map/request만 POST하고 요청 전후 사용자 전환 검사 (`src/online/hunting.ts` L9-L21). 로컬 잠금·스토리지는 UI 동작이며 서버 보장의 전제 아님.
- Reachability: live inventory에서 `hunt_once` SECURITY DEFINER, anon=false/authenticated=true (`audit-context/evidence/rpc-inventory.json` L2747-L2755); REST 인증 사용자는 UI 밖에서도 직접 RPC 요청 가능. 함수 search_path는 empty (live root L4-L5).
- Shared state/invariant couplings: `game_saves`, `player_wallets`, `market_assets`는 save/거래소/우편 등과 공유; `hunting_states`, 생활 products/food는 제작·회복·스탯/스킬 편집과 공유; 길드 treasury는 기부·입출고/정산과 공유. 본문이 보장하는 잠금 순서는 live root L24-L37이며 다른 모든 writer의 순서는 본 함수만으로 확립되지 않는다.

**Open Questions:**
- 현재 운영 equipment/stats/seal, monster/drop/skill/activity/cloud-record helper의 실제 정의·권한을 확보해 저장소 정의와 대조해야 한다. `combat_equipment_stats`가 root L52 및 refresh L14의 정확한 이름이다. refresh가 호출하는 `hunting_skill_set_bank`와 `hunting_level`도 운영 본문 미확보.
- 증거 추가에 따른 정정: village_life_user/sync/refresh hunting·life/conditions/premium의 기존 미확보 표시는 운영 snapshot 확인으로 해소했다. refresh의 premium 종료 시 기본 skill set 복귀를 추가했다. conditions/premium을 `nothing found`로 둔 초기 기록은 더 이상 적용하지 않는다.
- 영수증 PK/RLS/직접 테이블 권한의 현재 운영 상태, 영수증 정리 작업/보관 기간을 확인해야 한다. 여기서는 초기 저장소 DDL만 확인했다.
- 최초 서버 지갑 import의 payload가 어떤 bootstrap/save 경계에서 확립되는지, 모든 자산 생성 writer가 kind/grade/quantity 규칙을 유지하는지 전체 교차 분석이 필요하다.
- 스킬 설정 writer가 중복·slot 수·조건 크기 등을 어떤 규칙으로 유지하는지 별도 root 추적 필요. 이 root는 learned/weapon/type/MP를 사용 시 재검사하지만 설정 전체 규칙의 근거는 제공하지 않는다.
- 모든 경제 writer의 잠금 순서, DB 호출 트랜잭션 및 운영 timeout/동시 실행 제한·요청 빈도 제한은 본문 밖에 있다. root 자체의 시간당 요청 제한은 `nothing found`; 활력 및 최대 100턴은 확인됐다 (L39, L81, L257).
- runtime 인증 사용자/복수 연결 재현은 수행하지 않았다. 이 문서는 정적 읽기와 확보된 운영 함수 snapshot에 한정한다.
