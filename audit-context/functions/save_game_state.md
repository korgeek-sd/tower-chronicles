## `public.save_game_state` in audit-context/evidence/live-functions/public.save_game_state.sql (L1-L40)

**Purpose:** 로그인 사용자의 전체 클라이언트 저장 요청을 계정별 서버 저장·이력으로 바꾼다. 활성 플레이 임대와 현재 revision을 확인하고 서버 소유 경제 필드를 다시 투영한다. 함수는 SECURITY DEFINER이고 빈 search_path를 사용한다(동 파일 L1-L5). 이는 공격 판정 전 맥락 기록이며 취약점 판정·수정 제안·재현 코드는 포함하지 않는다.

**Inputs & Assumptions:**
- `p_lease_id uuid`, `p_generation bigint`, `p_client_instance_id text`, `p_device_id text`: 모두 untrusted RPC 인자. 네 값의 NULL은 거부하고 저장된 임대·generation·기기·client와 `IS DISTINCT FROM`으로 비교한다(동 파일 L9,L14-L15).
- `p_base_revision bigint`: untrusted 낙관적 동시성 값. 새 저장은 `<>0`, 기존 저장은 `current.revision<>p_base_revision` 조건을 사용한다. 명시적 NULL 검사: **nothing found**(L18,L29). 이 조건의 삼치 논리와 테이블 제약의 결합은 후속 단계 확인 사항이다.
- `p_save_schema integer`, `p_app_version text`: untrusted 메타데이터. 그대로 insert/update에 전달한다. 함수 내 허용 버전·길이·NULL 검사: **nothing found**(L21-L22,L36).
- `p_payload jsonb`: untrusted 전체 게임 상태. 앱은 `validSave`를 선행하지만 이는 클라이언트 검사이다(`src/online/cloudSave.ts:L72-L90`). 서버 root에는 동일 구조 검증 호출이 없으며 helper 투영·형변환과 DB 제약에 의존한다(라이브 root L19-L20,L30-L32).
- `p_payload_hash text`: untrusted 인자이나 함수 본문에서 사용하지 않는다. 저장 hash는 서버가 최종 payload에서 다시 계산한다(L1,L20,L32).
- 암묵 입력: `auth.uid()`, JWT `session_id`, `auth.sessions`, `private.active_game_sessions`, 현재 저장 및 경제 테이블, 트랜잭션 시각(L7-L16). JWT 서명 검증과 역할 선택은 함수 외 Supabase API 경계이며 본 함수에서 구현하지 않는다.

**Outputs & Effects:**
- `(revision, updated_at)` 한 행을 반환한다(L39). payload 자체는 반환하지 않는다.
- 전역 `tc-market-mutations` advisory transaction lock → 사용자 active session row lock → game_saves row lock 순서(L10,L14,L16).
- 최초 저장은 bootstrap payload를 revision 1로 저장하고 기본 소모품을 upsert한 뒤 경제 동기화를 호출한다(L17-L27).
- 기존 저장은 클라이언트 소비 반영 helper를 호출하고 서버 투영을 거친 payload/hash로 저장을 갱신한다. 이전 revision은 game_save_versions에 중복 무시 insert한다(L29-L37).
- 모든 쓰기는 단일 SQL 함수 호출 트랜잭션에 묶이며 본문에 오류를 삼켜 계속하는 예외 블록은 session UUID 파싱 블록 외 없다(L12,L17-L38). DB 제약·trigger는 아래 추가 근거를 참조한다.

**Block-by-Block:**

```sql
-- L9-L15
if p_lease_id is null or p_generation is null or p_client_instance_id is null or p_device_id is null then raise exception 'GAME_SESSION_LOST';end if;
perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
```
- **What:** 입력 누락을 거부하고 전역 시장 변경 잠금 뒤 사용자·Auth 세션·활성 임대를 검사한다(L9-L15).
- **Why here:** 저장 또는 경제 소비 전 실행하여 기존 임대 검사와 mutation을 같은 트랜잭션에 둔다(L16-L37).
- **Assumes:** auth.uid/JWT 값은 API에서 정해진다. 확인된 Auth 세션 행이 요청 사용자의 것인지 L13이 확인한다. auth.sessions 외부 lifecycle은 이 함수 범위 밖이다.
- **Establishes:** 유효 사용자, 존재하는 동일 사용자 Auth 세션, 만료 전이고 모든 바인딩 값이 일치하는 잠긴 active session(L11-L15).
- **Depended on by:** 아래 모든 읽기·쓰기는 `v_user`로 범위를 정한다(L16,L21-L37).

```sql
-- L16-L27
select * into v_current from public.game_saves where user_id=v_user for update;
-- missing row: bootstrap, hash, insert revision 1, consumables, economy sync
```
- **What:** 없는 저장은 신규 시작 상태를 만든다.
- **Why here:** 기존 저장 경로와 구분하여 소비 반영을 신규 계정에는 실행하지 않는다(L17-L30).
- **Assumes:** `server_bootstrap_payload`가 초기 경제를 정하고 sync helper가 그 저장에서 필요한 사설 행을 만든다. 라이브 bootstrap은 입력을 coalesce한 뒤 명시 필드만 `||` 덮어쓴다(`private.server_bootstrap_payload.sql:L7-L30`). 열거하지 않은 입력 필드는 보존된다. version 22, silver 0, 자원 0, 입장권·기본검·소모품·market.gold 1000, 직업/협회/탐험 초기화가 명시된다(동 파일 L10-L29).
- **Establishes:** 해당 사용자의 저장 revision 1, 최종 payload의 서버 계산 hash, 5종 소비품 행(L20-L26).
- **Depended on by:** 후속 save/RPC의 game_saves·wallet/assets 사용. bootstrap에서 `equipment_v23_payload` 호출은 **nothing found**; 같은 폴더의 장비 helper 존재만으로 적용되었다고 해석하지 않는다.

```sql
-- L29-L37
if v_current.revision<>p_base_revision then raise exception 'SAVE_CONFLICT';end if;
perform private.accept_client_economy_consumption(v_user,p_payload);
v_payload:=private.server_authoritative_payload(v_user,p_payload);
```
- **What:** revision 검사를 통과한 기존 저장의 소비를 먼저 반영하고 canonical projection을 생성해 이력·새 revision을 기록한다.
- **Why here:** 경제 소비 후 그 결과를 읽어 저장 payload를 만들며 이력은 갱신 전 원본을 보관한다(L30-L36).
- **Assumes:** helper 호출은 caller user 범위와 경제 단위를 지킨다. 라이브 소비 helper는 gear 및 equipment_v2를 수량 감소 루프에서 제외한다(`private.accept_client_economy_consumption.sql:L9-L17`). 하위 수량 parser의 분기까지 라이브 body를 확인했다(`private.client_asset_quantity.sql:L9-L18`).
- **Establishes:** 기존 저장 revision +1, 이전 저장 이력, 서버 hash(L32-L37). `p_payload_hash` 일치 검증을 의미하지 않는다.
- **Depended on by:** 앱의 결과 revision 확인 및 canonical payload 재읽기(`cloudSave.ts:L99-L106`).

**Cross-Function Dependencies:**
- 라이브 `server_authoritative_payload` (internal/source available): 먼저 경제 payload, 이후 potions, 보유량 이하 loadout(부활 최대 1), ownedJobIds/currentJobId, 협회 투영을 적용한다(`private.server_authoritative_payload.sql:L9-L26`). 그 외 필드를 일괄 제거하거나 모든 게임 진행 필드를 server-owned로 바꾸는 로직은 이 helper에서 **nothing found**.
- 라이브 `server_economy_payload`: wallet이 있으면 silver/gold를 wallet에서, items/equipmentItems/skillBooks/lootItems를 market_assets에서 생성한다. materials/tickets의 **key와 배열 길이는 요청 payload를 순회**하고 값은 해당 server asset quantity/0을 사용한다(`private.server_economy_payload.sql:L9-L32`). wallet이 없으면 원 payload에 skill/quest 투영만 적용하여 반환하는 분기가 있다(L9). wallet 존재를 이 root의 기존 저장 분기가 직접 확립하는 코드는 **nothing found**; 계정 lifecycle 증거가 필요하다.
- 라이브 `skill_progress_payload`: private.learned_catalog_skills에서 skillEnhancements만 교체한다(`private.skill_progress_payload.sql:L6`). `learned`/`skills` 전체 권한의 근거로 확대하지 않는다.
- 라이브 `quest_ticket_payload`: cosmetics의 다른 입력 key는 병합 보존하며 summonTickets를 appearance_ticket_wallets 수량/0으로 바꾼다(`private.quest_ticket_payload.sql:L6`).
- 라이브 `server_association_payload`: 서버 membership projection과 eligibility 기반 traderCertified로 교체한다(`private.server_association_payload.sql:L11-L15`). 하위 라이브 projection은 활성 membership이 없으면 빈 협회, 있으면 그 협회의 구성원/최근 30개 활동/금고 수량을 투영하고 신청·금고장부는 빈 배열을 반환한다(`private.server_association_projection.sql:L14-L22,L28-L74`).
- 라이브 `accept_client_economy_consumption`: 사용자 assets 중 gear/equipment_v2를 제외하고 잠근 뒤 client_asset_quantity가 더 작으면 수량 감소/삭제, payload.items에 없는 legacy gear 삭제(`private.accept_client_economy_consumption.sql:L9-L17`). 라이브 client quantity helper는 material/ticket/skillbook/other를 읽고 그 외 0, 누락·문자열 숫자 아닌 값도 0 반환한다. material/ticket의 tier 정수 변환 예외는 0으로 처리하고 최종 bigint 변환의 예외는 이 helper에서 잡지 않는다(`private.client_asset_quantity.sql:L9-L18`). **정정:** 초안의 옛 repo 소비 helper와 달리 라이브 함수는 equipment_v2도 제외한다.
- 라이브 `sync_market_economy_from_latest_save`: 저장이 없으면 CLOUD_SAVE_REQUIRED, 이미 wallet이면 revision이 뒤처진 경우만 revision 메타데이터를 진전시키고 반환한다. wallet 없는 경우 저장 payload에서 wallet·V2장비·자원·입장권·스킬북·loot을 bootstrap한다(`private.sync_market_economy_from_latest_save.sql:L12-L67`). V2장비는 입력 equipmentItems의 id/gear를 사용하며 여기서 장비 세부 값 정규화·생성 catalog 조회는 **nothing found**(L35-L39). 이는 root 최초 저장의 bootstrap 미교체 필드와 결합되는 맥락이며 권한 영향은 downstream 사용 분석 전 판정하지 않는다.
- 라이브 `server_consumables_json`: user/id별 5종 수량 또는 0(`private.server_consumables_json.sql:L7-L13`); 라이브 직업 helpers는 entitlement 집계와 entitlement 존재하는 current job만 선택(`private.server_owned_jobs_json.sql:L7-L8`, `private.server_current_job.sql:L7-L13`).
- 라이브 `stable_json_string`: object key C 정렬, array 순서 유지, scalar JSON 텍스트를 재귀 직렬화(`private.stable_json_string.sql:L11-L23`). 서버 hash는 `extensions.digest` SHA256(root L20,L32); cryptographic implementation은 DB extension black box이다.
- 앱 caller: `reconcileCloudState`는 remote/hash/meta user/revision에 따라 push/pull/noop을 선택하며 충돌 시 remote를 다시 읽는다(`src/online/cloudSync.ts:L15-L53`). `saveCloudState`는 fresh token과 lease를 JSON body로 전송하고 성공 후 canonical 저장을 다시 읽는다(`cloudSave.ts:L72-L106`). direct RPC callers가 이 앱 경로를 따라야 한다는 서버 보장은 없다.
- import 경로: 파일 5MB 제한·확인 → repository.importSave → onImported(`src/components/SaveManagement.tsx:L11,L27`); envelope/JSON 파싱 후 임시 repository load·마이그레이션/검증(`src/storage/repository.ts:L304-L313`); 기존 로컬 백업 뒤 저장 교체(L353-L358); active 세션이면 React state 수용(`src/main.tsx:L299`). 일반 cloud sync는 활성 lease를 요구하며 진행 중 expedition은 서버 run 복원으로 보내고, 그 외 reconcileCloudState 호출(L336-L349). 가져오기 자체에 별도 서버 복원 RPC 호출은 없다.
- 공유 상태: game_saves/game_save_versions, wallet/assets, consumables, learned_catalog_skills, appearance_ticket_wallets, job entitlement/selection, association membership/eligibility. 서버 경제 mutation들과 직렬화 계약이 결합된다(root L10,L16,L24-L37; 위 helper 근거). 다른 모든 writer의 lock order·trigger는 이 root 분석에서 전수 검증하지 않았다.
- 접근 범위: `audit-context/evidence/rpc-inventory.json`에서 root는 authenticated=true/anon=false, 사설 소비·동기화 helper는 authenticated=false/anon=false로 기록된다. 이는 추출 시점 ACL이며 직접 table ACL/RLS와 동일한 의미는 아니다.

**운영 제약·trigger 추가 근거:**
- `game_saves`는 user_id PK, revision>=1 CHECK, auth.users FK ON DELETE CASCADE를 가진다(`audit-context/evidence/constraints.json:L27-L40`). save_schema/app_version/payload/payload_hash/revision은 NOT NULL이고 app_version은 text, payload는 jsonb이다(`audit-context/evidence/columns.json:L153-L191`). 수집된 CHECK 목록에서 payload 구조/metadata 허용 버전 검사는 **nothing found**. 저장 열 revision의 NOT NULL은 요청 인자 p_base_revision의 NOT NULL 검사와 다른 경계다.
- game_saves는 INSERT 또는 revision/payload/payload_hash UPDATE 뒤 `private.sync_market_economy_after_save` trigger를 실행한다(`audit-context/evidence/triggers.json:L152-L156`). trigger body는 `new.user_id`로 경제 sync를 호출하고 new를 반환한다(`private.sync_market_economy_after_save.sql:L7-L10`). 따라서 신규 root는 game_saves INSERT의 AFTER trigger에서 wallet/assets가 이미 bootstrap된 뒤, 소모품 upsert 및 명시 sync로 이어진다(root L21-L27). 기존 root UPDATE 역시 같은 trigger를 거친다. **정정:** 초안은 명시 L27 호출만 설명했으나 실제 운영에는 이 암묵 호출이 먼저 있다.
- game_saves UPDATE 전후에는 village_war_guard_snapshot/village_war_refresh_snapshot도 연결된다(`triggers.json:L158-L168`). market_assets에는 같은 두 함수 및 challenge_asset_to_product가 연결된다(L50-L66). 이 세 trigger 함수의 현재 본문은 이 기록에서 확보하지 않아 더 깊은 권한·추가효과는 미확인이다.
- wallet INSERT와 잔액 변경 UPDATE는 operations_capture_wallet trigger로 연결된다(`triggers.json:L110-L120`). 그 body는 INSERT를 initial_sync로, UPDATE를 잔액 차액으로 분류해 0 아닌 통화를 operations_economy_ledger에 기록한다(`private.operations_capture_wallet.sql:L9-L20`). 하위 operations_wallet_source 분류 함수는 이 기록에서 미분석이다.
- 직접 접근: game_saves는 RLS enabled, authenticated SELECT 허용이나 table/column INSERT·UPDATE 허용은 모두 false이다(`table-inventory.json:L2025-L2040`). game_save_versions는 anon/authenticated의 SELECT·쓰기가 false이다(L2008-L2023). wallet/assets도 RLS enabled이며 수집된 table/column client 권한은 false이다(L665-L680,L1345-L1360). 실제 SELECT가 자기 행으로 한정되는 정책 내용은 별도 policy 증거와 합쳐 확인해야 한다.

**Open Questions:**
1. root에서 호출하는 애플리케이션 SQL helper 본문 및 그 하위 helper는 이 기록에 열거한 라이브 파일까지 확보·읽었다. auth.uid/auth.jwt와 PostgreSQL built-in·pgcrypto 내부 구현은 black box이다. 다른 writer/trigger와 모든 downstream 소비자는 전수 추적 완료로 표시하지 않는다.
2. p_base_revision NULL 분기와 SQL 삼치 논리, p_payload 비객체 처리, schema/app_version 허용 범위는 후속 분석 대상이다. NULL 저장 열은 운영 NOT NULL로 제한되지만 p_base_revision은 테이블에 저장되지 않으며 root의 명시 NULL 검사는 확인되지 않는다. 추가 trigger 세 함수의 body는 미확인이다.
3. bootstrap이 덮어쓰지 않는 progression/stats/cosmetics/equipmentItems 등 필드별 실제 authoritative reader는 무엇인가? root에서 통째로 입력을 사용하는 사실만으로 gameplay 권한 판정을 하지 않는다.
4. INSERT/UPDATE trigger는 저장 뒤 경제 sync를 수행한다. 기존 save에 wallet이 projection **이전부터** 반드시 존재한다는 모든 lifecycle/삭제 권한 경로는 아직 전수 확인하지 않았으므로 server_economy_payload의 no-wallet 분기 조건을 남겨 둔다.
5. import와 server run 복원/장비 규칙 버전 변환의 전체 상호작용, auth 계정 교체 중 await 경계, public table RLS/직접 update 권한은 별도 기록과 합쳐 확인해야 한다.
6. 운영 실제 기기·동시부하·signed-in import 수동 실험은 수행하지 않았다. SQL/클라이언트 경로 읽기만 수행했다.
