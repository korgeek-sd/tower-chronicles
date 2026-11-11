## `sendChatMessage` in src/online/chat.ts (L50)

기준: `d4b8883`. 범위는 공개 전송 진입점 하나이며, 아래 API·트리거·구독·화면은 해당 진입점의 의존 경로다. 루트가 수집한 운영 카탈로그 스냅샷을 후속 대조했다. 아래 운영 근거 절에서 소스 일치가 확인된 부분과 외부 Realtime 동작의 미확인을 구분한다.

**Purpose:** 전체/원정단 채팅 입력을 PostgREST INSERT로 전송하고, 확인된 서버 메시지를 호출 UI에 돌려준다. 공개 래퍼 L50 → 설정 확인 L48 → `createChatApi(...).send` L31-L45 경로다.

**Inputs & Assumptions:**
- `body:string`: 사용자 입력, untrusted. NFC·trim 및 1~200 Unicode code point/제어·숨김 문자 검사는 `validateChatBody` L7-L9. 서버는 자체 정규화·문자 길이를 검사한다(`20261001010353_association_hq_chat.sql` L165-L168).
- `clientId:string`: 브라우저 요청 식별자, untrusted. UI가 `crypto.randomUUID()`로 생성하고 같은 본문 실패 재시도 동안 유지한다(`WorldChat.tsx` L18,L44-L54). DB 타입은 uuid, `(user_id,client_id)` UNIQUE(`20261001003135_world_chat.sql` L2-L10). 공개 API 함수 자체의 UUID 형식 검사는 nothing found; DB 타입에 의존한다.
- `associationId:string|null`: 선택 채널, untrusted. UI는 현재 원정단 조회 결과로 정한다(`WorldChat.tsx` L10-L15). 소속 권한은 서버 트리거에 의존한다(`20261001010353_association_hq_chat.sql` L153-L157).
- 세션·설정: `api`가 `supabaseConfig` 유무 확인 후 `getFreshSession`을 주입한다(chat.ts L48). 현재 로컬 세션이 60초 이상 남았으면 사용하고 아니면 refresh(auth.ts L145-L149). 서버 JWT 검증은 외부 PostgREST/Auth 경계이며 JWT 검증의 런타임 동작은 외부 서비스 경계다.
- 플레이 활성 lease는 이 요청 인자에 없다(chat.ts L33). UI `enabled`는 전송 전 확인하지만(`WorldChat.tsx` L45), 해당 채팅 SQL 트리거의 조건은 auth UID·비익명·프로필·원정단 소속이다(SQL L148-L157). 채팅 자체에 활성 게임 lease를 요구하는 코드: nothing found.

---

**Outputs & Effects:**
- `/rest/v1/game_chat_messages?select=*`에 POST, 공개 key 및 bearer JWT, JSON `{body,client_id,association_id?}`, 10초 timeout, `Prefer:return=representation`(chat.ts L23-L26,L33).
- 성공은 파싱된 `ChatMessage` 하나. userId/clientId/channel이 전송 당시 세션/인자와 같아야 한다(L44). JSON·네트워크·비정상 응답은 throw한다(L26,L28,L42-L44).
- 서버 저장 컬럼: body/UUID client_id/선택 association_id; 서버 트리거가 sender·nickname·created_at을 정한다(SQL L170; 초기 테이블 L2-L10). 메시지 INSERT는 Realtime publication 대상이고 cron은 7일 이전 행을 제거한다(`20261001003135_world_chat.sql` L50-L55).
- UI 성공은 메시지 병합, draft/요청 ID 해제, 2초 로컬 cooldown; 실패는 오류 표시와 기존 요청 ID 유지(`WorldChat.tsx` L47-L54).

---

**Block-by-Block:**

```ts
// src/online/chat.ts L50
export const sendChatMessage=(body:string,clientId:string,associationId:string|null=null)=>api(associationId).send(body,clientId);
```
- **What:** 채널별 API를 생성하여 입력을 그대로 전송 함수에 넘긴다.
- **Why here:** 설정 누락 오류가 네트워크보다 앞선다(L48).
- **Assumes:** 인증·검증·권한의 실제 구현은 아래 의존 함수들이다.
- **Establishes:** 독자적인 인증/저장 불변식은 없다.
- **Depended on by:** `WorldChat.send` L50은 반환 메시지가 확정된 서버 행이라고 취급한다.

```ts
// src/online/chat.ts L31-L33
const {body,error}=validateChatBody(value);if(error)throw Error(error);
const {response,data,s}=await call('game_chat_messages?select=*',/* POST */);
```
- **What:** 본문 검증 후 fresh-session bearer로 INSERT한다.
- **Why here:** 비정상 로컬 본문은 HTTP 전에 중단한다.
- **Assumes:** 로컬 검사는 UX이고, 직접 REST 요청의 검증은 DB가 수행해야 한다. 서버 `prepare_chat_message` L148-L171이 비익명/프로필/현재 소속·본문·귀속을 수행한다.
- **Establishes:** 이 함수가 보내는 JSON에 sender/name/time은 포함하지 않는다(L33).
- **Depended on by:** 응답 검증은 전송 당시 세션 `s`를 기준으로 한다(L44).

```ts
// src/online/chat.ts L34-L44
if(!response.ok){ /* 23505 recovery, mapped errors, throw */ }
const message=rows(data)[0]; /* identity/channel checks */ return message;
```
- **What:** UNIQUE 충돌이면 같은 계정·client ID·채널의 기존 행을 GET한다(L35-L37); 소속/속도/본문 오류를 번역하고 나머지는 공통 실패로 처리한다(L39-L42).
- **Why here:** INSERT가 커밋된 뒤 응답이 유실된 재시도에서 기존 행을 돌려준다. 네트워크 예외 자체는 자동 재전송하지 않고 UI의 유지된 ID에 의존한다(`WorldChat.tsx` L47-L54).
- **Assumes:** 충돌 행의 읽기 권한은 RLS가 결정한다. 재조회도 `call`이 세션을 다시 취득한다(L23-L26); 원래 `s.userId` 필터와 반환 userId 확인이 있다(L36-L37).
- **Establishes:** 성공 POST 경로는 user/client/channel 일치를 검사(L44); 충돌 회복 경로는 서버 필터와 userId 비교(L36-L37)에 의존한다. 본문 동일성 비교는 두 경로 모두 nothing found.
- **Depended on by:** UI는 중복 메시지를 행 id로 합친다(L51 및 chat.ts L18-L19).

---

**Cross-Function Dependencies:**
- `getFreshSession` (internal-source-available): auth.ts L145-L149; refresh는 L120-L139, refresh token HTTP 실패는 null, 정상은 `/auth/user` 검증 함수 결과와 같은 userId 및 저장 스냅샷 비교 후 저장(L125-L136). 로그인 전체 루트는 별도 담당 범위다.
- DB/PostgREST (external-source-available migrations, 운영 근거 후속 대조 완료): 초기 테이블 RLS enable·익명/기본/인증 전권 revoke 후 authenticated select 및 body/client_id 열 INSERT만 grant(`20261001003135_world_chat.sql` L13-L22), 후속 association_id 열 grant(`20261001010353_association_hq_chat.sql` L136-L137). UPDATE/DELETE의 authenticated grant는 이 관련 마이그레이션에서 nothing found.
- 최신 소스 SELECT 정책: 비익명 UID/프로필 및 world(NULL) 또는 `private.my_chat_association()` ID 일치(SQL L140-L143). helper는 auth.uid 현재 ACTIVE 소속과 프로필을 반환(L124-L128). INSERT 정책은 user_id=auth.uid 및 비익명(초기 SQL L21-L22); 소속은 BEFORE INSERT definer 트리거가 검사한다(후속 SQL L144-L172).
- `private.prepare_chat_message` (external-source-available): 프로필 `FOR UPDATE`(L151) → 선택 소속 membership/association `FOR SHARE`(L154-L155) → 새 요청인 경우 계정 마지막 created_at 대비 2초 cooldown(L159-L163) → 본문 검사 → user/name/time 서버 귀속. 기존 client ID는 cooldown을 건너뛰지만 UNIQUE 충돌 경로로 간다(초기 SQL L9, 후속 SQL L158-L164). 실제 동시 실행은 미검증이며 운영 트리거 설치는 아래 근거로 확인했다.
- Realtime 구독은 send와 별도 네트워크 경로: `subscribeChatMessages` L108-L109 → `createChatSubscription` L53-L106. 연결 때 사용자 일치(L64-L65), JWT join(L74), heartbeat20초·세션 refresh30초(L75-L76). WAL system-ok 이후 subscribed(L85-L90), broadcast는 수용 분기 없음, 해당 테이블 INSERT와 파싱·associationId 일치만 callback(L92-L94). world 구독은 서버 filter를 명시하지 않으며 최종 채널 판별은 L93; 원정단 구독은 association filter L74. 각 구독에서 실제 RLS 적용은 Supabase Realtime 외부 경계이며 운영 확인 대기다.
- 구독 정리: close 시 presence 해제와 backoff 재연결(L59-L60,L99), visibility/online resume 및 unmount cleanup(L103-L105). 소속 UI 조회는 열린/inline 화면에서30초(`WorldChat.tsx` L14), 바뀐 associationId는 effect cleanup/reload(L20-L38).
- 읽기/표시: `parseChatMessage`는 필수6개 문자열, 날짜 파싱, 본문 형식 검사(chat.ts L11-L16); `mergeChatMessages` id 중복 제거·시간/id 정렬·최근50개 제한(L18-L19). UI는 nickname/body를 React JSX 문자열 자식으로 렌더링하며 HTML 삽입 sink를 사용하지 않는다(`WorldChat.tsx` L61,L75). nickname 길이·정규화는 이 parser에서 nothing found; 프로필 생성 규칙은 별도 확인 항목이다.
- 모니터링은 구독 상태를 `setWebsocketPresence`로 비동기 전달하고 오류를 무시한다(chat.ts L109). 이 경로는 채팅 저장 성공 조건이 아니다.
- 테스트 증거(실행하지 않음): tests/chat.test.ts L6-L31 본문·payload·중복·signed-out/rate, L33-L57 mock socket broadcast 제외/WAL 준비/cleanup, L59-L65 원정단 필터. 실제 RLS/Postgres/웹소켓 통합을 증명하는 테스트로 취급하지 않는다.

---

**Open Questions:**
- 운영 열 INSERT 권한이 있다는 점은 확인했다. 현재 evidence의 열 권한은 집계 Boolean이므로 정확히 허용된 열 목록은 마이그레이션과 추가 개별 column grant 조회를 구분해야 한다.
- 운영 Realtime의 SELECT RLS 재평가, 탈퇴/삭제·토큰 해제 시 이미 열린 원정단 구독의 전달 경계는 무엇인가? 소스의 클라이언트 채널 필터만으로 답하지 않는다.
- 프로필 nickname 생성/변경 루트의 입력 보장과 auth session 폐기 후 아직 유효한 access token의 처리 정책은 별도 기록과 연결해야 한다.
- 동일 요청 ID·다른 본문, 계정 전환 중 POST/충돌 GET, 소속 변경 중 응답 도착의 UI 상태 의미는 별도 행위 검증 대상으로 남긴다. 여기서는 판정·재현·수정을 수행하지 않았다.

---

**운영 카탈로그 후속 대조:**
- `evidence/table-inventory.json` L1974-L1990: game_chat_messages RLS=true, force_rls=false, anon SELECT/write/column INSERT=false, authenticated SELECT=true, authenticated table write=false **이지만 client_column_insert=true**. 따라서 테이블 수준 write=false를 채팅 전송 불가능으로 해석하지 않는다. client_column_update=false도 기록되어 있다.
- `evidence/policies.json` L2-L21: 실제 SELECT는 UID/비익명/프로필 및 NULL 채널 또는 현재 원정단 helper ID를 요구하며, INSERT WITH CHECK는 user_id=auth.uid와 비익명을 요구한다. 위 최신 마이그레이션 의미와 일치한다.
- `evidence/triggers.json` L140-L144: BEFORE INSERT 트리거가 private.prepare_chat_message를 호출하도록 설치되어 있다. 실제 `evidence/live-functions/private.prepare_chat_message.sql` L9-L18의 인증/프로필/ACTIVE 원정단 잠금 검사, L20-L25의 계정별 cooldown, L26-L32의 본문/서버귀속을 직접 읽었다.
- 실제 `evidence/live-functions/private.my_chat_association.sql` L7-L10은 호출자 UID의 ACTIVE 소속, 비익명, 프로필 조건을 적용한다.
- `evidence/constraints.json` L2-L25: association/profile FK, 본문 길이1~200, PK(id), UNIQUE(user_id,client_id)가 실제 존재한다. 컬럼 타입/NULL 가능성은 `evidence/columns.json` L58-L113과도 대응한다.
- `evidence/publications.json` L2-L5: supabase_realtime에 game_chat_messages가 포함된다. `evidence/cron.json`의 tower-world-chat-retention 항목은 매시17분,7일 이전 행 DELETE,active=true다. 이는 설치 상태 근거이며 실제 websocket 전달·탈퇴 직후 권한 재평가·작업 실행 성공을 증명하지 않는다.
- 결론 범위: 운영 선언과 소스의 해당 규칙을 대조했으며 데이터 변경, 실제 계정 전송, 구독 연결 또는 실행 재현은 하지 않았다.
