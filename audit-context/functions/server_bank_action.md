## `public.server_bank_action` in audit-context/evidence/live-functions/public.server_bank_action.sql (L1-L117)

**Purpose:** 로그인한 플레이어의 서버 은행 설립·예치·인출·담보 수령·대출·상환을 단일 RPC에서 수행하고, 요청 영수증 및 서버 경제 저장을 함께 반환한다(실서버 스냅샷 L23-L116). 은행 이름·이율·금고·대출은 브라우저 은행 데이터에서 가져오지 않는다(L25-L38, L77-L90).

**Evidence scope:** 이 문서에서 `live`는 `audit-context/evidence/live-functions/`의 읽기 전용 운영 정의, `repo`는 기준 커밋 d4b8883의 소스다. 루트, `require_active_game_session`, `server_economy_payload`, `village_life_user`, `sync_market_economy_from_latest_save`, `settle_server_bank_loan`, `server_bank_state`, `process_server_bank_due`의 live 본문을 확인했다. persist·cloud_record·premium helper 및 테이블 제약은 repo 정의를 읽었으며 운영 동일성은 별도 확인 대상이다. 추가 운영 snapshot을 받은 뒤 wrapper·sync·정산·state·cron의 미확인 범위를 아래처럼 좁혔다. 운영 RPC 목록에서 authenticated=true/anon=false다(`audit-context/evidence/rpc-inventory.json:L3278-L3286`).

**Inputs & Assumptions:**
- `p_lease_id` uuid, `p_generation` bigint, `p_client_instance_id` text, `p_device_id` text: 모두 untrusted. live `private.village_life_user.sql:L6-L8`의 wrapper가 NULL을 거절하고 공통 guard를 호출한다. live `private.require_active_game_session.sql:L8-L26`은 auth.uid, JWT session_id, auth.sessions 실제 행, 만료, lease·generation·auth_session·device·client 일치를 확인하고 활성 세션 행을 잠근다.
- `p_request_id` uuid, `p_action` text, `p_params` jsonb: untrusted. NULL 거절, params object 및 직렬화 크기 2,048 bytes 제한(live L12). 서버 영수증 fingerprint는 별도 해시가 아닌 action 및 jsonb 동등성이고 사용자+UUID로 검색한다(L13-L17).
- 암묵적 입력: 서버 시계(L18,L22), 서버 wallet/assets, 은행·대출·제재·원정 상태(L19-L21,L34-L110). 생성의 premium은 서버 helper 결과를 신뢰한다(L24); repo `supabase/premium-account.sql:L7`은 계정 만료 시각을 검사한다.
- 사전조건: 공유 경제 advisory lock을 제일 먼저 획득(L10), 이후 인증(L11). 같은 잠금을 사용하는 다른 writer들과 lock 질서가 맞아야 한다. repo 은행 migration의 save 패치 L44-L55 및 due worker L253-L260이 이를 사용한다. 모든 운영 writer가 이 질서를 지키는지의 전체 보장은 이 단일 함수 분석에서 nothing found.

**Outputs & Effects:**
- 성공 반환은 result(최초 작업 결과), 최신 bank state, cloud record이다(live L16,L116). 재생 응답은 저장된 result와 현재 state/record의 조합이며 최초 응답 바이트 재현이 아니다(L16).
- 신규 작업은 지갑/금고/담보/대출/ledger 변경 후 경제 payload 저장과 request 영수증 삽입을 수행한다(L34-L115). 예외를 잡는 블록이 없으므로 이 RPC 내부의 예외 경로는 정상 결과를 반환하지 않는다(L9-L117).
- repo 테이블은 user/request 복합 PK, 은행 owner unique, 양수 대출·허용 ticket·상태·금고 범위 제약, private 테이블 RLS 및 직접 권한 철회를 둔다(`supabase/migrations/20261019113009_server_bank_authority.sql:L2-L42`). 운영 제약의 현재 동일성은 이 문서에서 확인하지 않았다.

---

**Block-by-Block:**

```sql
-- live L10-L18
perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
```
- **What:** 공유 잠금·사용자 검증 후 입력 형식과 기존 영수증을 검사한다(L10-L17). 같은 UUID의 다른 action/params는 BANK_REQUEST_CONFLICT, 동일하면 즉시 반환한다. 신규 성공 영수증이 최근 1분 30건이면 제한한다(L18).
- **Why here:** 재생 분기는 sync·원정 검사·업무 분기보다 앞서므로 기존 작업을 재실행하지 않고 현재 상태만 조회한다(L16-L23).
- **Assumes:** auth guard가 실제 로그인 세션을 확인한다(live guard L14-L24). 영수증 내구성은 repo PK(L25-L28)가 맡는다.
- **Establishes:** 이후 신규 경로의 u는 검증된 세션 사용자이고 이미 완료된 동일 UUID는 신규 부작용에 진입하지 않는다.
- **Depended on by:** 모든 wallet owner 조건 및 request 삽입(L34-L115).

```sql
-- live L19-L22
perform private.sync_market_economy_from_latest_save(u);
```
- **What:** 서버 경제를 준비한 뒤 save projection 또는 실제 online_expeditions에 ACTIVE 원정이 있으면 거절하고 서버 시각 t를 고정한다(L19-L22).
- **Why here:** 각 업무가 wallet/assets 행을 쓰기 전에 준비한다. live sync `private.sync_market_economy_from_latest_save.sql:L12-L65`는 기존 wallet이 있으면 revision만 갱신하고, 최초 wallet 부재일 때만 save의 실버·gold·equipment/material/ticket/book/loot를 가져온다.
- **Assumes:** 최초 save payload의 출처·수치가 앞선 저장/bootstrap 경로에서 정해져 있다. 이 root는 해당 값을 다시 검증하지 않는다. 이 함수 안에서 최초 payload의 신뢰성을 확립하는 검사: nothing found; 저장/초기화 분석에 연결해야 한다.
- **Establishes:** 신규 은행 거래는 이 시점의 원정 없음 조건 및 공통 서버 시각을 사용한다.
- **Depended on by:** 모든 잔액·담보 변경과 만기 비교.

```sql
-- live L23-L38
if p_action='CREATE' then
```
- **What:** premium·미소유 확인, 자본금 1,000,000..1e12·이율 1..50·trim 이름 2..30·기간 5/10/15/30 및 1..4개 검증 후 기간 중복을 제거한다. 조건부 wallet 차감 성공 뒤 은행/ledger 생성한다(L24-L38).
- **Why here:** 은행을 생성하기 전에 실버 차감이 성립해야 한다(L34-L36).
- **Assumes:** premium helper와 owner unique 제약(repo bank L3)이 유효하다.
- **Establishes:** 생성 자본금은 caller wallet에서 이동하며 저장 이율·기간은 서버 검증 결과다.
- **Depended on by:** BORROW의 금액·이자·기간 산정(L80-L88), 조회 directory.

```sql
-- live L39-L66
elsif p_action in ('DEPOSIT','WITHDRAW','CLAIM_COLLATERAL') then
```
- **What:** owner_id=u 은행을 FOR UPDATE 선택한다. CLAIM은 네 ticket 허용 목록과 양수 담보를 잠금 조회한 뒤 담보를 0으로 하고 caller assets에 더한다(L40-L51). 입출금은 정수형식/1..1e12 검증 후 DEPOSIT은 wallet≥amount 조건 차감→금고 증가, WITHDRAW는 vault≥amount 조건 차감→wallet 증가; 각각 ledger 기록(L53-L64).
- **Why here:** 소유 은행을 먼저 찾고, 각 지급 전 원천 잔액 또는 담보를 소모한다.
- **Assumes:** 대상 wallet은 sync가 준비했고 제약/거래 원자성이 유지된다.
- **Establishes:** bankId를 클라이언트가 지정해 남의 금고를 이 분기에서 선택하지 않는다(L40).
- **Depended on by:** 최종 서버 payload 저장 및 state(L114-L116).

```sql
-- live L67-L91
elsif p_action='BORROW' then
```
- **What:** 진행 대출 20개 제한·제재/미상환 유예기간 제한, bank UUID와 ticket·정수 수량1..1e6·기간 검증. 은행 행을 잠그고 자기 은행/미지원 기간을 제외한다. 원금=담보수량×50,000; 은행 금고 조건부 차감과 caller ticket 조건부 차감 후 caller wallet 지급, 서버 bank 이율로 floor 이자와 서버시각 기준 maturity/grace 저장, ledger 기록(L68-L91).
- **Why here:** 지급은 금고 및 담보가 모두 확보된 뒤다(L82-L86). 이율은 요청 값이 아니라 잠근 은행 값이다(L88).
- **Assumes:** 실패 시 앞선 차감이 전체 거래와 함께 취소된다. loan 제약은 repo bank L9-L17이다.
- **Establishes:** borrower=u, bank 소유자≠u, 기간·담보·원금·이자는 서버 계산으로 묶인다.
- **Depended on by:** REPAY와 자동 정산은 이 계약을 사용한다.

```sql
-- live L92-L113
elsif p_action='REPAY' then
```
- **What:** loan UUID와 borrower=u로 잠금 조회, ACTIVE/GRACE_PERIOD 및 만기 도래를 요구한다. grace 종료 후 정산 helper 호출 및 DEFAULTED 결과, 종료 전은 principal+interest를 wallet에서 조건부 차감→은행 금고 지급→같은 ticket 반환→REPAID 및 ledger 기록이다. 기타 action은 거절한다(L93-L113).
- **Why here:** 소유 및 terminal status 검사가 지급보다 앞서고 만기 판단은 서버 t를 쓴다.
- **Assumes:** `settle_server_bank_loan`는 caller가 공유 잠금을 가졌음을 전제로 한다(repo bank L57-L63). live `private.settle_server_bank_loan.sql:L8-L35`는 없는/종료/미도래 대출에 no-op, grace 이후 DEFAULTED·은행 담보·15일 제재, ACTIVE이고 상환 가능하면 자동지급·반환·저장, 아니면 GRACE_PERIOD/reminder로 전이한다. 이 root에서 호출되는 grace 종료 경로는 해당 helper의 default 분기에 대응한다.
- **Establishes:** 직접상환은 본인 계약만 대상이며 최초 terminal 전이 후 동일 계약의 신규 REPAY는 거절된다(L94-L96).
- **Depended on by:** 영수증의 result.status 및 후속 bank state.

```sql
-- live L114-L116
perform private.persist_market_economy_to_save(u);
insert into private.server_bank_requests(user_id,request_id,action,params,result) values(u,p_request_id,p_action,p_params,result);
```
- **What:** 모든 신규 성공 경로의 경제 저장→영수증→응답을 통합한다.
- **Why here:** 부작용을 마친 뒤 UUID가 완료 상태로 기록된다; 재생 분기는 이 줄로 내려오지 않는다(L16).
- **Assumes:** repo persist `supabase/migrations/20260928014500_equipment_v2_cutover_v0164.sql:L389-L403`가 game_saves 잠금·기존 버전 보존·server_economy_payload 투영·SHA256·revision+1·wallet sync revision을 함께 수행한다. live payload `private.server_economy_payload.sql:L9-L32`는 wallet·assets에서 재화/장비를 복원하며 skill/quest projection helper를 호출한다.
- **Establishes:** 정상 신규 응답은 기록된 request 결과를 갖는다(L115-L116).
- **Depended on by:** client가 응답 record를 적용하고 UUID pending을 지우는 처리(`src/online/bank.ts:L27-L31`).

---

**Cross-Function Dependencies:**
- `village_life_user` (internal, live available) → `require_active_game_session` (internal, live available): 세션·사용자 경계. live wrapper L6-L8, live guard L8-L26.
- `sync_market_economy_from_latest_save` (internal, live available): `private.sync_market_economy_from_latest_save.sql:L12-L25`의 기존 wallet 경로는 revision만 동기화하며, L27-L65의 최초 wallet 경로는 save 경제를 가져온다.
- `premium_active` (internal, repo available): CREATE 권한 및 state. `supabase/premium-account.sql:L7`; 운영 만료·부여 writer의 전체 경로는 별도 분석 대상이다.
- `settle_server_bank_loan` (internal, live available): `private.settle_server_bank_loan.sql:L8-L35`의 terminal 대출 정산. helper는 loan row lock만 획득하며(L8), 공유 advisory lock은 root L10 또는 live worker L10이 획득한다.
- `persist_market_economy_to_save` (internal, repo available): 서버 경제 save 투영/버전. equipment_v2 migration L379-L405. `server_economy_payload`의 live body와 하위 skill/quest 호출은 별도 저장 분석과 결합해야 한다.
- `server_bank_state` (internal, live available): userId·premium·잔액·ticket·제재, 최대100 은행 directory(금고 포함), 본인 bank/loans, 최근50 본인 ledger를 반환한다(`private.server_bank_state.sql:L6-L24`). directory는 다른 은행의 name/rate/durations/vault를 반환하는 공개 범위다(L11-L13).
- `cloud_record_json` (internal, repo available): user_id로 해당 save record를 반환한다(`supabase/migrations/20260926022500_server_economy_authority_v0149.sql:L100-L102`).
- **Callers:** `src/online/bank.ts:L16-L20`은 fresh bearer 사용자 동일성과 lease/device + request UUID/action/params를 전달한다. pending은 user별 sessionStorage이며 UUID 생성 전 저장하고 같은 action/JSON문자열 params만 재사용한다(L12,L34-L40). 응답 오류의 모든 4xx는 pending을 제거하고(L23-L25), 정상 응답은 userId/기본 구조와 최종 계정 재확인 후 제거한다(L27-L31). 이 재시도 수명 정책은 server의 user+UUID 계약과 별개다. UI는 locked ref로 실행 중 중복 조작을 막고 명시적 retry/confirmation을 둔다(`src/components/bank/BankScreen.tsx:L26-L38,L46,L51,L68`).
- **Shared state:** get_server_bank가 같은 user의 만기 계약을 정산한다(bank migration L117-L128); live cron worker는 공통잠금을 try-acquire하고 최대100 계약 정산 및 계약별 예외 로그/계속 처리를 한다(`private.process_server_bank_due.sql:L9-L18`). 운영 cron은 `server-bank-settlement`, 매분, active=true이며 같은 worker를 호출한다(`audit-context/evidence/cron.json:L2-L7`). market/save/은행은 wallet/assets 및 save revision을 공유한다.

**Open Questions:**
- 현재 운영 persist, cloud_record_json, premium_active 및 테이블 제약 정의는 repo와 동일한가? wrapper·sync·bank_state·settle·due worker 및 매분 활성 cron은 추가 live snapshot으로 확인되어 이 질문에서 제외했다.
- 최초 wallet bootstrap으로 가져오는 save 경제 값은 어느 저장/bootstrap 경로가 확립하는가? 이 root 안에는 최초 값 출처 검사가 없다.
- 요청 영수증 보존·삭제 정책 및 최근 성공 요청 기반 rate count의 전체 운영 수명은 무엇인가? 루트 및 읽은 bank migration에서 삭제 경로는 nothing found.
- client의 모든 4xx pending 제거 이후 사용자가 같은 의도를 새 UUID로 제출할 때 어떤 사용자 상태/재확인 흐름이 성립하는가? 네트워크 결과와 auth/lease 오류의 조합은 이 단계에서 실행하지 않았다.
- 운영의 다른 economy writers 모두 동일 advisory lock→session/save/wallet 잠금 순서를 사용하는가? root와 은행 get/cron 및 save 패치 외 전체 경로는 본 기록 범위 밖이다.
