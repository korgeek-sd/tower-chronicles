## `completeGoogleOAuth` in src/online/auth.ts (L74-L100)

**Purpose:** Google OAuth 복귀 URL을 탭의 PKCE 거래와 연결하고 Supabase Auth가 확인한 세션만 저장한다. 일반 URL이면 기존 저장 세션을 돌려준다 (`src/online/auth.ts:L74-L99`). 분석 기준 커밋: `d4b88839612d3335e81f537c70c89ca41e9d7f6e`.

---

**Inputs & Assumptions:**
- `url:string`: 신뢰하지 않는 쿼리·fragment 입력. URL 파싱과 callback 표식 검사 후 거래 검증을 거친다 (`src/online/auth.ts:L75-L90`). 잘못된 절대 URL은 `new URL`에서 예외가 전파된다 (L75).
- `config:SupabasePublicConfig|null`: 반신뢰 설정. 실제 호출자는 빌드 환경에서 읽은 `supabaseConfig`를 전달한다 (`src/online/auth.ts:L110`; `src/online/config.ts:L5-L16`). 설정 로더는 비어 있는 값·잘못된 URL을 거부하고 HTTPS 또는 localhost/127.0.0.1 URL을 허용한다. `completeGoogleOAuth` 자체의 설정 원점 재검증은 **nothing found** (L90-L94).
- `storage:Storage`: 반신뢰 브라우저 세션 저장소. 실제 호출 기본은 localStorage이며 토큰과 사용자 ID가 JSON으로 남는다 (`src/online/auth.ts:L30-L40,L102,L110`). 저장값의 진위·서명 확인은 일반 URL 반환 경로에서 **nothing found**; 그 경로는 필드 타입만 확인한다 (L30-L38,L78).
- `transactions:Storage`: 반신뢰 탭 저장소. 실제 호출자는 sessionStorage를 전달한다 (L110). 정상 생성자는 암호학적 난수 32바이트 state/verifier, SHA-256 challenge, 생성 시각과 복귀 origin+pathname을 기록한다 (L42-L60). 동일 origin 스크립트의 저장소 접근 배제는 함수 내부에서 **nothing found**.
- `request:typeof fetch`: 실제 운영 기본은 브라우저 fetch, 테스트에서는 주입한다 (L74; `tests/authPkce.test.ts:L18-L23`). Auth 응답은 외부 서비스 입력이며 토큰 필드·만료·`/user` 결과를 검사한다 (`src/online/auth.ts:L63-L71`).
- 암묵 입력: Date.now, URL/URLSearchParams, Storage, AbortSignal 및 fetch 동작. 브라우저 API의 정상 동작은 플랫폼에 의존한다 (L75-L99).

---

**Outputs & Effects:**
- 일반 URL: `OnlineSession|null` 반환; getStoredSession은 읽기/JSON 오류에 null을 반환한다 (L30-L38,L78).
- callback: 거래 레코드를 네트워크 요청 전에 삭제한다. 이후 실패해도 복구하지 않는다 (L79-L81).
- 성공: `/token?grant_type=pkce` POST, `/user` GET 후 검증된 세션을 AUTH_SESSION_KEY에 JSON 저장하고 반환한다 (L92-L99,L63-L71,L40).
- 실패: 명시 오류 또는 URL/Storage/네트워크/timeout/JSON 예외를 호출자에게 전파한다. 실패 경로에서 이 함수가 기존 세션을 명시적으로 삭제하는 코드는 없다 (L74-L99).

---

**Block-by-Block:**

```typescript
// src/online/auth.ts:L75-L81
const current=new URL(url),fragment=new URLSearchParams(current.hash.slice(1));
const hasLegacyTokens=fragment.has('access_token')||fragment.has('refresh_token');
const isCallback=hasLegacyTokens||current.searchParams.has('code')||current.searchParams.has(OAUTH_STATE_PARAM)||current.searchParams.has('error')||fragment.has('error');
if(!isCallback)return getStoredSession(storage);
const raw=transactions.getItem(OAUTH_TRANSACTION_KEY);
transactions.removeItem(OAUTH_TRANSACTION_KEY);
```
- **What:** callback 여부를 구분하고 거래를 소비한다.
- **Why here:** 비동기 처리 전에 동일 탭의 거래 재사용을 막는 상태 전이를 수행한다 (L80-L81).
- **Assumes:** 저장소 read/remove가 완료되어야 이후 진행한다; 실패는 전파된다 (L79-L81).
- **Establishes:** 정상 삭제 후 이후 callback은 같은 저장 거래를 다시 읽을 수 없다 (L79-L81).
- **Depended on by:** 거래 검증·토큰 교환 (L84-L97).

```typescript
// src/online/auth.ts:L82-L90
if(hasLegacyTokens)throw Error('AUTH_IMPLICIT_REJECTED');
let transaction:OAuthTransaction;
try{transaction=JSON.parse(raw??'null');}catch{throw Error('AUTH_REQUEST_MISSING');}
const code=current.searchParams.get('code'),state=current.searchParams.get(OAUTH_STATE_PARAM);
if(!transaction||typeof transaction.state!=='string'||typeof transaction.verifier!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(transaction.verifier)||
 !Number.isFinite(transaction.createdAt)||transaction.createdAt>Date.now()||Date.now()-transaction.createdAt>OAUTH_TTL_MS||
 transaction.redirectBase!==current.origin+current.pathname||state!==transaction.state||current.searchParams.getAll(OAUTH_STATE_PARAM).length!==1)throw Error('AUTH_REQUEST_MISMATCH');
if(current.searchParams.has('error')||fragment.has('error'))throw Error('AUTH_PROVIDER_REJECTED');
if(!config||!code||code.length>2048||current.searchParams.getAll('code').length!==1)throw Error('AUTH_RESPONSE_INVALID');
```
- **What:** implicit 토큰 거부, JSON 거래 파싱, verifier 형식·10분 TTL·미래 시각·복귀 경로·단일 state 일치 및 단일 code 검사를 한다 (TTL L44).
- **Why here:** 모든 검사 실패는 토큰 요청 이전에 끝난다 (L82-L92).
- **Assumes:** 저장 state의 랜덤성은 생성자 L47,L53에 의존하며 검증부는 state의 타입과 일치만 검사한다 (L86-L88).
- **Establishes:** 진행 시 code는 비어 있지 않고 2048자 이하이며 거래의 경로/state/시각 조건을 만족한다 (L85-L90).
- **Depended on by:** verifier와 code를 외부 Auth로 보내는 다음 블록.

```typescript
// src/online/auth.ts:L91-L99
const previous=storage.getItem(AUTH_SESSION_KEY);
const response=await request(config.url+'/auth/v1/token?grant_type=pkce',{
 method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},
 body:JSON.stringify({auth_code:code,code_verifier:transaction.verifier}),signal:AbortSignal.timeout(15000),
});
if(!response.ok)throw Error('AUTH_CODE_EXCHANGE_FAILED');
const session=await verifiedTokenSession(config,await response.json(),request);
if(storage.getItem(AUTH_SESSION_KEY)!==previous)throw Error('AUTH_ACCOUNT_CHANGED');
return storeSession(session,storage);
```
- **What:** 15초 제한의 PKCE 교환 후 토큰을 `/user`로 확인하고, 시작 시점과 저장 세션의 문자열이 같을 때 저장한다.
- **Why here:** 로컬 세션 쓰기는 두 외부 응답 검증과 비동기 사이 저장값 변경 검사 뒤에 있다 (L97-L99).
- **Assumes:** token endpoint가 PKCE verifier/code를 검증하고 `/user`가 해당 bearer의 사용자 ID를 반환한다. 서버 구현은 이 저장소에서 **nothing found**; 외부 검증 경계다 (L92-L97,L67-L71).
- **Establishes:** 응답 토큰은 비어 있지 않은 문자열, 만료는 유한한 미래 시각, 사용자 ID는 `/user`의 비어 있지 않은 문자열이다 (L64-L71). 저장 시점 직전 값은 이전 문자열과 일치한다 (L98).
- **Depended on by:** 앱의 저장 세션 소비 및 후속 bearer 요청. 반환 전에 storeSession이 실패하면 예외가 전파된다 (L40,L99).

---

**Cross-Function Dependencies:**
- `verifiedTokenSession` (internal): access/refresh 문자열 및 만료 검사 → `/user` 요청 → HTTP 실패 거부 → JSON user.id 검사 → 세션 구성. 네트워크/JSON 오류 전파; 모든 성공 경로에서 user.id는 원격 `/user`에서 온다 (`src/online/auth.ts:L63-L72`). JWT 로컬 decode는 이 경로에서 호출하지 않는다 (L97).
- `getStoredSession` (internal): 콜백이 아니면 필드 타입을 확인한 저장값 또는 null; 파싱/Storage 실패 null (L30-L38,L78).
- `storeSession` (internal): JSON 직렬화·저장 후 같은 객체 반환, 저장 예외를 처리하지 않음 (L40,L99).
- Caller `consumeOAuthRedirect`: 실제 창 URL에서 callback 표식을 확인하고 code/state/error/fragment를 history에서 지운 뒤 원래 URL과 sessionStorage를 전달한다 (L102-L110). `error_description`만 있는 URL도 여기서는 정리되나 root에서는 callback 표식이 없어 저장 세션 반환 경로다 (L77,L104-L110).
- Upstream `startApp`: OAuth 소비 완료를 기다린 뒤 React를 렌더하며, 실패는 일반 로그인 오류 메시지 상태에 반영하고 앱 렌더를 계속한다 (`src/main.tsx:L477-L483`).
- Upstream 거래 생성: `signInWithGoogle`은 복귀 origin을 현재 창과 비교하고 `createGoogleOAuthUrl`로 이동한다 (`src/online/auth.ts:L113-L116`); 생성자는 탭 거래를 새 값으로 덮어쓴다 (L55).
- Shared state: refresh 함수도 AUTH_SESSION_KEY를 읽고 쓰며 비동기 전후 원문을 비교한다 (L120-L139). signOut은 저장 세션과 탭 거래를 먼저 제거한 뒤 원격 logout을 호출한다 (L152-L159). 저장 세션이 시작과 끝 사이 변했다가 같은 문자열로 복구되는 이력 자체를 식별하는 별도 세대 값은 **nothing found** (L91,L98).
- External black boxes: 브라우저 Storage/history/crypto/fetch 및 Supabase Auth token/user endpoints. Google은 authorize 생성 upstream에 명시되지만 root는 Google을 직접 요청하지 않는다 (L57-L60,L92-L97).
- 기존 테스트는 정상 PKCE·거래 소모·중복/다른 탭/경로·기존 계정 보존·로그아웃 중 응답·URL 정리를 검증한다 (`tests/authPkce.test.ts:L11-L58,L86-L99`). 이번 분석에서는 실행하지 않았다.

---

**Open Questions:**
- 운영 Supabase Auth의 OAuth redirect allowlist와 PKCE code 유효기간/단일 사용 정책은 어떤 설정인가? 이 함수의 저장소 소스만으로는 확정하지 않는다.
- 브라우저 동일 origin에서 실행 가능한 전체 스크립트와 CSP/확장 프로그램/저장소 노출 조건은 별도 공격 경로 분석 범위다.
- 실제 운영 빌드의 Supabase URL·인증 제공자 설정은 이 함수 분석에서 외부 조회하지 않았다.
