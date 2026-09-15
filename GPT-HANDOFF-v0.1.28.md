# 《탑의 기록》 v0.1.28 개발 인계 문서

아래 내용을 이 프로젝트의 최신 개발 상태로 인식한다.

## 1. 최신 프로젝트 위치

- 실제 작업 폴더: `E:\ChatGPT\게임만들기\battle-redesign`
- 바로 실행할 파일: `E:\ChatGPT\게임만들기\battle-redesign\play.html`
- 기술 구성: React 19, TypeScript, Vite
- 앱 버전: `0.1.28`
- 최신 저장 스키마: `v19`
- 현재 실제 콘텐츠 범위: 철맥의 첨탑 1~10층

`play.html`은 JavaScript와 CSS가 포함된 오프라인 실행본이며 같은 폴더의 `assets`를 사용한다. 소스 수정 후에는 프로덕션 빌드와 `node scripts/standalone.mjs`를 실행해 `play.html`을 다시 생성해야 한다.

## 2. Git 상태

- GitHub Private 저장소: `https://github.com/korgeek-sd/tower-chronicles`
- GitHub 기준 버전: v0.1.27
- 원격 기본 브랜치: `main`
- v0.1.27 기준 커밋: `df8e1eb55601621f13365571054c7140e2b19345`
- 원격 태그: `v0.1.27`
- 현재 로컬 작업 브랜치: `codex/v0.1.28-save-stability`
- v0.1.28 구현 커밋: `38d71e7` (`feat: add v0.1.28 save data protection`)
- v0.1.28 커밋은 아직 GitHub에 push하지 않았다.
- GitHub 인증 정보는 작업 후 로컬에서 제거했다. push하려면 다시 인증해야 한다.

상위 폴더 `E:\ChatGPT\게임만들기`는 별도의 빈 Git 저장소이며, `battle-redesign`을 독립 저장소로 관리한다. 상위 저장소의 history를 수정하지 않는다.

## 3. v0.1.28 목표와 결과

이번 업데이트의 목표는 기능 확장보다 저장 안정화와 기존 기능 회귀 방지였다.

구현된 내용:

1. 거점 화면에 `저장 관리` 진입 버튼을 추가했다.
2. 현재 게임 상태를 JSON 파일로 내보낼 수 있다.
3. 내보낸 파일은 다음 봉투 구조를 사용한다.
   - `format: "tower-chronicles-save"`
   - `formatVersion: 1`
   - `appVersion: "0.1.28"`
   - `exportedAt`: ISO 날짜 문자열
   - `state`: 실제 `GameState`
4. JSON 저장 파일 가져오기를 추가했다.
5. 가져오기 전에 JSON 파싱, 봉투 형식 버전, 실제 게임 상태를 전부 검증한다.
6. v1~v18 원본 저장을 가져오면 기존 migration 체계를 사용해 최신 v19로 변환한다.
7. 유효한 파일만 현재 저장에 적용한다.
8. 가져오기 직전에 기존 메인 저장을 `tower-record-v1-before-manual-import` 키로 백업한다.
9. 백업 저장이 실패하면 기존 메인 저장을 덮어쓰지 않는다.
10. 손상된 JSON, 지원하지 않는 미래 봉투 형식, 유효하지 않은 게임 상태를 거부한다.
11. 가져오기 파일 크기는 UI에서 최대 5MB로 제한한다.
12. 가져오기 성공 후 앱 상태, 저장 오류 차단 상태, 현재 화면을 정상적으로 갱신한다.

## 4. 중요한 저장 규칙

- 브라우저 메인 저장 키는 계속 `tower-record-v1`을 사용한다. 기존 사용자의 저장 위치 호환성을 위해 키를 바꾸지 않는다.
- `GameState.version`의 최신 값은 `19`다.
- v0.1.28에서 저장 스키마를 불필요하게 v20으로 올리지 않았다. 앱 버전과 저장 스키마 버전은 서로 다른 개념이다.
- 저장 데이터 검증과 v1~v19 호환 로직은 `src/storage/repository.ts`에 있다.
- 원정 중 HP, 적 상태, 전리품, 포션, 턴, 효과, 몬스터 런타임, 반응 준비 상태도 내보내기 대상에 포함된다.
- `localStorage`는 향후 온라인 게임의 권위 있는 데이터 저장소로 사용하면 안 된다.
- 서버 도입 후 Silver, Gold, 아이템, 거래소 등 경제 데이터의 최종 판정은 서버가 맡아야 한다.
- 로컬 JSON 가져오기로 서버 경제 데이터를 덮어쓸 수 있게 만들면 안 된다.

## 5. 주요 변경 파일

- `src/storage/repository.ts`
  - 앱·내보내기 형식 상수
  - `serializeSaveExport`
  - `parseSaveImport`
  - repository의 `exportSave`, `importSave`
  - 가져오기 전 백업 키
- `src/components/SaveManagement.tsx`
  - 저장 내보내기·불러오기 화면
  - JSON 다운로드
  - 5MB 제한, 교체 확인, 오류 메시지
- `src/main.tsx`
  - v0.1.28 표시
  - 저장 관리 페이지 연결
  - 가져오기 성공 후 앱 상태 복구
- `src/style.css`
  - 저장 관리 화면 버튼 스타일
- `tests/storage-management.test.ts`
  - 내보내기 봉투
  - 이전 버전 migration
  - 손상·미지원 파일 거부
  - 가져오기 전 백업
  - 백업 실패 시 원본 보호
- `STABILITY-v0.1.28.md`
  - 이번 업데이트 설명
- `README.md`, `package.json`, `package-lock.json`
  - 버전과 최신 검증 결과 반영

## 6. 검증 결과

- 전체 자동 테스트: `240개 통과 / 실패 0개`
- TypeScript 검사: 성공
- Vite 프로덕션 빌드: 성공
- 오프라인 `play.html` 생성: 성공
- `git diff --check`: 성공
- 구현 커밋 직후 작업 트리: clean

일반 개발 환경의 검증 명령:

```sh
npm run typecheck
npm test
npm run build
node scripts/standalone.mjs
```

현재 Codex 환경에서는 `npm`이 PATH에 없을 수 있다. 이 경우 번들 Node.js로 로컬 `node_modules`의 TypeScript, Vite와 테스트 실행기를 직접 실행했다. 이는 프로젝트 코드 오류가 아니다.

## 7. 기존 기능 유지 범위

다음 v0.1.27 기능은 삭제하거나 구조를 되돌리지 않았다.

- 수동 턴제 일반·보스 전투
- 몬스터 AI와 준비 공격
- Reactive Prepared와 직접 피격 트리거
- 공통 보호막과 상태효과
- 원정 임시 전리품, 안전 귀환, 사망 손실
- 랜덤 이벤트와 보스 조우
- 직업, 장비, 숙련도, 제작, 프리셋
- Silver와 Gold 분리
- 거래소와 조합
- 외형과 칭호
- v1~v18 저장 migration과 단계별 백업

## 8. 다음 작업 시 지켜야 할 사항

1. 작업 시작 전 현재 브랜치와 Git status를 먼저 확인한다.
2. 이 문서와 실제 코드를 비교하고 실제 코드가 다르면 실제 코드를 우선한다.
3. 저장 필드를 추가할 때만 다음 스키마 버전과 migration을 설계한다.
4. 기존 저장을 변환하기 전에 원본 백업을 먼저 성공시킨다.
5. migration 실패나 백업 실패 시 메인 저장을 변경하지 않는다.
6. 전투·원정 상태를 가져오는 중 임의로 초기화하거나 보상을 재지급하지 않는다.
7. 변경 후 전체 테스트, 타입 검사, 빌드, 독립 실행본 생성을 수행한다.
8. `dist`, `play.html`, 루트 `assets`는 생성 결과이며 `.gitignore` 대상이다.
9. 새 기능을 GitHub에 올리기 전 v0.1.28 브랜치의 커밋과 테스트 결과를 확인한다.

## 9. 권장 다음 업데이트

다음 단계는 철맥의 첨탑 1~10층을 실제 플레이 기준으로 반복 테스트하는 것이 좋다.

- 새 게임 → 1층 입장 → 전투 → 전리품 획득 → 안전 귀환
- 사망 시 임시 전리품과 남은 원정 포션 손실
- 이벤트 선택 후 저장·새로고침·복귀
- 보스 추적도 누적과 광산 오우거 반복 조우
- 저장 파일 내보내기 후 같은 파일 다시 불러오기
- 모바일 세로 화면의 버튼 잘림과 스크롤 확인

그다음 업데이트 후보는 `붉은 송곳니의 성소 1~10층 실제 콘텐츠`, `플레이어·스킬 전투 에셋`, 또는 `온라인 서버 도입을 위한 클라이언트/서버 상태 경계 분리`다.
