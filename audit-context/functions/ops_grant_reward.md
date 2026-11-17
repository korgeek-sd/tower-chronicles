## `public.ops_grant_reward` in audit-context/evidence/live-functions/public.ops_grant_reward.sql (L1-L22)

**Purpose:** 운영 권한 사용자가 특정 플레이어에게 보상 우편을 생성하고 요청별 감사 기록을 남기는 RPC다. 지급 생성과 실제 재화 수령은 분리된다(L19-L21). 기준 소스는 운영 DB 함수 snapshot이며 저장소 migration에 이 함수 정의나 프런트 호출자는 발견되지 않았다(`src`, `supabase` 전체 문자열 검색, baseline `d4b8883`).

**Inputs & Assumptions:**
- `p_user_id` UUID, `p_reward` JSONB, `p_reason` text, `p_request_id` UUID: 전부 외부 입력. 대상/요청 UUID와 사유 길이 3..200은 L10, 보상은 L11에서 검증한다.
- 호출자는 인증된 DB 역할로 진입할 수 있다. anon=false/authenticated=true인 인벤토리 근거: `audit-context/evidence/rpc-inventory.json:L2891-L2898`. SECURITY DEFINER와 빈 search_path는 root L3-L5.
- 운영 권한은 게임 길드장 등 게임 내 역할이 아니라 `auth.uid()`에 대응하는 `auth.users.raw_app_meta_data.coupon_admin` 값이 문자열 추출 시 `true`인 계정이다(`public.is_coupon_admin.sql:L1-L8`). 클라이언트 user metadata는 이 조회에 사용되지 않는다. 그 app metadata를 부여/회수하는 운영 절차와 권한 관리자는 **nothing found**; 후속 확인 대상이다.
- 세션: root와 admin helper는 `auth.uid()` 존재 및 app metadata만 확인한다. active gameplay lease, device, generation, `auth.sessions` 유효성 직접 조회는 이 경로에서 **nothing found** (`private.assert_operations_admin.sql:L7-L9`, root L9-L20). JWT 검증/세션 폐기 즉시 반영 여부는 외부 인증 경계의 가정이다.
- 대상 프로필 존재는 L12가 확립한다. 대상 접속/lease는 조건이 아니다.

**Outputs & Effects:**
- 신규: `private.game_mail` 보상 우편 한 행, `private.operations_audit` 감사 행을 동일 호출에서 생성하고 `{mailId,duplicate:false}` 반환(L19-L21).
- 재요청: 기존 감사 행의 대상/보상/정규화 사유가 일치하면 기존 mailId와 duplicate=true 반환(L14-L17); 우편이 아직 존재하거나 미수령인지 다시 읽지는 않는다.
- 충돌/입력/권한/프로필/insert 오류는 예외로 종료한다(L9-L20). 예외를 삼키는 분기는 없다. 실제 지갑 증가·아이템 전달은 이 함수의 쓰기가 아니다(L19-L20).

---

**Block-by-Block:**

```sql
-- root L9-L12
perform private.assert_operations_admin();
-- null UUID / trimmed reason length check
perform private.validate_coupon_reward(p_reward);
-- target profile existence check
```
- **What:** 권한→입력→보상형식→대상 순서로 선행 조건을 만든다.
- **Why here:** 권한 없는 호출은 대상/요청 기록을 읽기 전에 종료한다.
- **Assumes:** admin helper의 DB metadata가 운영 승인 계정을 뜻해야 한다. helper는 null uid 또는 is_coupon_admin=false를 `OPERATIONS_FORBIDDEN`으로 종료하고, 나머지는 반환한다(`private.assert_operations_admin.sql:L7-L9`). is_coupon_admin은 해당 auth.users 행/metadata 일치 여부만 반환한다(`public.is_coupon_admin.sql:L7`).
- **Establishes:** 이후 입력은 non-null 대상/요청, 길이 제한 사유, 프로필 존재를 만족한다(root L10-L12).
- **Depended on by:** 요청 키 생성, 우편과 감사 insert.
- **Validator 따라가기:** 운영 snapshot `audit-context/evidence/live-functions/private.validate_coupon_reward.sql:L8-L21`은 null/비객체/빈 객체/알 수 없는 최상위 키를 거절한다. silver/gold는 정수 숫자·0..1e9; items는 최대20개 배열, 각 원소는 id/quantity, 수량1..1e6, 허용 ID 두 종(enhancement_stone, job_draw_ticket)이다. 화폐 둘이0이고 items가 빈 배열이면 거절한다. 반복 item ID 합산 상한이나 items 원소의 추가 키 거절은 해당 본문에서 **nothing found**. 숫자0/빈 items만 허용하는지 여부는 마지막 합계 검사(L21)에 의존한다.

```sql
-- root L13-L18
perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
select * into prior from private.operations_audit where actor_id=auth.uid() and request_id=p_request_id;
-- found: compare target/reward/reason, return duplicate or raise REQUEST_CONFLICT
```
- **What:** actor+request 단위 트랜잭션 advisory lock 뒤 감사 기록을 조회한다.
- **Why here:** 같은 actor/key 재요청의 조회와 insert를 이 함수 경로에서 직렬화한다.
- **Assumes:** 모든 관련 작성 경로가 같은 요청키 의미를 공유하고, 기존 감사 details는 reward/reason/mailId를 가진다. 현재 제약 snapshot은 UNIQUE(actor_id,request_id)를 확립한다(`audit-context/evidence/constraints.json:L43-L56`). 타 작성자의 details 스키마 준수는 **nothing found**; root는 action을 조회조건에 넣지 않는다(L14).
- **Establishes:** 기존 행 발견 시 새 우편 insert로 가지 않는다(L15-L18). 보상 비교는 JSONB 값, 사유는 btrim 결과, 대상은 UUID text 비교다(L16).
- **Depended on by:** 신규 insert 분기와 클라이언트의 재시도 결과 해석.

```sql
-- root L19-L21
insert into private.game_mail(...) values (...,'ops:'||p_request_id,...,'coupon_reward',1,p_reward) returning mail_id into v_mail;
insert into private.operations_audit(...) values(auth.uid(),'reward_grant',p_user_id::text,...,p_request_id);
return jsonb_build_object('mailId',v_mail,'duplicate',false);
```
- **What:** 사유를 우편 body로 저장하고 보상 JSON을 attachment_reward에 넣은 뒤 행위자/대상/보상/사유/mailId/request를 감사에 남긴다.
- **Why here:** 검증 및 중복 분기 뒤에만 쓰기가 온다. 두 insert 사이 예외 처리·외부 호출은 없다.
- **Assumes:** 대상+event_key 우편 키 의미는 모든 운영자 사이에서도 유지된다. event_key에는 actor가 없지만 감사 조회에는 actor가 포함된다(L14,L19). DB 제약이 이를 어떻게 처리하는지는 다음 단계에서 확인할 것.
- **Establishes:** 성공 반환 시 두 insert가 같은 DB 트랜잭션에 속한다. `game_mail` 역사적 DDL은 `(user_id,event_key)` unique와 기본30일 만료, 직접 접근 revoke/RLS를 둔다(`supabase/migrations/20261001132943_game_mail.sql:L2-L14`). operations_audit 현재 구조는 actor_id/action/details NOT NULL, target_id/request_id nullable, details 기본빈객체다(`audit-context/evidence/columns.json:L10-L48`). RLS=true, force_rls=false이며 anon/authenticated 테이블·칼럼 SELECT/INSERT/UPDATE 권한은 false다(`audit-context/evidence/table-inventory.json:L1091-L1107`). 수집된 triggers.json/policies.json 전체에서 operations_audit 항목은 없었다. 이는 관리자 definer 함수의 작성 의미를 제한하는 별도 details CHECK의 근거가 되지는 않는다.
- **Depended on by:** 수신자의 mail claim, 운영 감사 조회.

---

**Cross-Function Dependencies:**
- `private.assert_operations_admin` / `public.is_coupon_admin`: internal, 운영 snapshot 확보. 모든 root 분기의 첫 권한 경계이며 위에서 전체 본문을 추적했다.
- `private.validate_coupon_reward`: internal, 운영 snapshot 전체 분기는 위 기록(`private.validate_coupon_reward.sql:L8-L21`). 인벤토리 존재/비공개 확인(`rpc-inventory.json:L1856-L1863`).
- `auth.uid`, advisory lock/hash, JSONB·문자열 연산: PostgreSQL/Supabase 런타임 호출. uid는 요청 인증 설정에서 온다고 가정하며 이 검토는 auth schema 구현을 복제하지 않는다.
- Caller: root 이름으로 프런트 호출자 발견 없음. public authenticated RPC로 직접 호출 가능한 DB 역할은 인벤토리에 기록된다(L2891-L2898). UI 관리 패널 유무와 무관하게 서버 admin helper가 최종 역할 경계다.
- Reward delivery: 역사적 `manage_game_mail`은 active lease를 받고 canonical save를 잠근 다음 소유자/만료 조건에 맞는 우편을 잠근다(`20261002074216_coupon_redemption.sql:L156-L170`). claim/claim_all이며 미수령 attachment면 `deliver_coupon_reward` 후 claimed_at을 기록, 변경 시 save에 경제상태를 저장한다(L172-L187). 운영 snapshot `private.deliver_coupon_reward.sql:L9-L14`에서도 다시 validate → 기존 wallet 증가(없으면 COUPON_WALLET_MISSING 예외) → items마다 deliver_market_asset(u,id,quantity,null) 순서가 확인된다. items가 없으면 loop0회이고 화폐만 전달된다. helper 자체는 uid/lease를 다시 검사하지 않으며 수령기의 인가와 정합성 보장에 의존한다(L1-L15). 현재 mail 본문/하위 asset 전체 경로는 별도 우편 수령 분석과 연결한다. 역사적 manage_game_mail 설명을 현재 운영 본문 대체로 취급하지 않는다.
- Shared state: coupons/redeem 및 친구초대도 coupon_reward 우편을 만든다(`20261002074216_coupon_redemption.sql:L118-L122`, `20261003050924_friend_invites.sql:L76-L80`). 따라서 동일 우편 수령기와 reward validator에 의존한다.

**Open Questions:**
1. 운영 DB operations_audit 컬럼·FK·UNIQUE·RLS·직접 권한·트리거/정책 수집은 확인 완료했다. 아직 모든 definer 작성자의 details 스키마와 action/request UUID 공유 규약은 확인하지 않았다. 현재 우편 수령은 별도 분석과 연결한다. validator/delivery 본문 확인도 완료했다. 역사적 mail migration을 운영 현재 상태라고 간주하지 않는다.
2. app metadata 운영 권한 부여·회수 절차, 감사 보존·변경 권한, 관리자 MFA/세션 정책은 무엇인가? 저장소에서는 **nothing found**.
3. 인증 JWT에서 auth.uid로 전달되는 런타임 검증과 만료/폐기된 세션 처리 정책은 무엇인가? 이 함수에는 active lease를 요구하는 분기가 없다.
4. 다른 운영 RPC와 동일 actor/request UUID를 공유하는 규약, 다른 actor가 동일 request UUID로 같은 대상에게 지급하는 의미는 무엇인가?
5. 실제 클라이언트/운영 콘솔 호출자는 어디에 배포되어 있는가? 현재 repo src에는 호출자 **nothing found**.
