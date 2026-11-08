# 탑의 기록 인게임 알림과 Android 푸시

## 현재 구현 범위
- 서버 보관 알림센터: 로그인 계정만 자신의 알림 조회·읽음 처리 가능
- 실시간 이벤트 기반 기록: 골드 매수/매도 체결, 우편 도착, 은행 만기·자동 상환·채무 불이행, 원정단 경매 낙찰·상위 입찰, 영지 전쟁 선포·종료
- 미수령 우편의 종료 24시간 전 1회 경고
- 골드 거래 주문은 등록 30일 후 미체결 분량만 서버 지갑으로 환급. 1분 단위 서버 처리, 우편과 알림센터 기록 포함.
- 본인 직접 취소한 골드 주문은 기존 거래 우편만 발송하고 중복 푸시는 발송하지 않음
- Android Capacitor plugin으로 OS 권한 획득, 기기 FCM 토큰 등록과 알림 선택 시 관련 화면 이동
- Firebase HTTP v1 전송을 위한 서비스 전용 Edge Function과 Vault 기반 cron 호출 준비

## FCM을 실제 사용하려면 필요한 비공개 설정
현재 공개 저장소에 Firebase 인증 파일이나 서버 비밀키를 보관하지 않습니다. 아래 항목이 등록되기 전에는 Android 푸시 발송은 동작하지 않습니다.

1. Firebase Console에서 Android 앱 패키지 `com.studio1524.towerchronicles`을 추가하고 Cloud Messaging API(HTTP v1)를 활성화합니다.
2. Firebase Android 파일 `google-services.json`의 원본을 Base64로 인코딩한 값만 GitHub Repository Actions Secret `FIREBASE_GOOGLE_SERVICES_JSON_BASE64`에 등록합니다. 원본 파일을 GitHub에 커밋하지 않습니다.
3. Firebase 프로젝트의 서비스 계정 키 JSON을 Supabase Edge Functions secret `FIREBASE_SERVICE_ACCOUNT_JSON`에 설정합니다. Android 파일과 서버 서비스 계정 파일은 서로 다른 자료입니다.
4. 안전한 랜덤 비밀 문자열(최소 32자)을 생성해 Supabase Edge Functions secret `GAME_PUSH_DISPATCH_SECRET`에 설정합니다.
5. 같은 문자열을 Supabase Vault에 `game_push_dispatch_secret`라는 이름으로 저장합니다. 예: Dashboard의 Vault를 이용하거나 SQL editor에서 `select vault.create_secret('...','game_push_dispatch_secret');`를 실행합니다. 기존 비밀값을 공개 문서나 채팅에 붙여넣지 않습니다.
6. Edge Function `send-game-push`가 배포되어 있어야 합니다. GitHub에 있는 `supabase/functions/send-game-push/index.ts`를 배포하며 JWT 검증은 함수 자체의 공유 비밀 헤더로 수행하므로 `verify_jwt=false`를 사용합니다. 공유 비밀이 일치하지 않으면 HTTP 403을 반환합니다.
7. 새 Android APK 설치 후 게임 로그인 → 상단 알림 종 아이콘 → '휴대전화 알림 허용'을 선택합니다. Android 13 이상에서 알림 권한을 허용합니다.

## 보안 및 실패 처리
- 푸시 토큰은 private 스키마에 저장되며 타 계정은 조회하거나 삭제할 수 없습니다.
- 백엔드 발송 RPC는 service_role 전용입니다. 사용자는 임의의 푸시 내용을 만들거나 다른 계정의 알림을 볼 수 없습니다.
- 대기열 항목은 3분 재시도 제한 및 최대 5회 전송 시도. 늦은 알림 방지를 위해 24시간 경과한 이벤트는 푸시하지 않습니다.
- 발송 실패해도 이미 지급된 골드·실버·보상은 건드리지 않습니다.
- Firebase 인증정보가 준비되지 않으면 전송 작업은 실행되지 않으며 게임 내 알림센터 기록은 계속 유지됩니다.

## 검증
- GitHub Actions의 Tower Chronicles CI, Build Android APK 결과 확인
- 알림센터에서 본인 알림만 읽히는지 확인
- Android 실제 단말에서 화면 잠금 상태의 푸시 수신·클릭 복귀 테스트 필요
- 복수 단말 및 로그아웃 후 알림 차단 확인 필요
