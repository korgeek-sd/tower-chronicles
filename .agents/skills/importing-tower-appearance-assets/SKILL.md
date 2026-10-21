---
name: importing-tower-appearance-assets
description: Use when a user provides an image to add, replace, or update a Tower Chronicles appearance (외형) character artwork.
---

# 탑의 기록: 외형 이미지 안전 등록

이 스킬은 `.agents/skills/tower-skin-manager/SKILL.md`의 병렬 배포 절차를 따른다. **이미지 변환만으로 등록 또는 배포 완료라고 보고하지 않는다.**

## 실행 절차
1. 최신 `main` 카탈로그에서 외형 ID와 기존 등급을 확인한다. 세션마다 `skin/<id>-<고유작업식별자>`라는 새 브랜치를 만든다. `main` 직접 푸시 금지.
2. 현재 환경에서 Chrome/Edge가 사용 가능하면 `node scripts/import-appearance.mjs <id> "<image-file-path>"`를 실행한다. 이 스크립트는 **기존 카탈로그 ID의 외형 이미지만 교체**한다. 신규 외형은 별도 카탈로그 추가가 필요하다. 브라우저가 없으면 동일한 1024×1024 투명 WebP 및 SHA-256(12자리) 규칙으로 직접 준비한다.
3. 스크립트는 `public/assets/characters/appearances/<id>-<hash12>.webp`와 `src/game/data/cosmetics.ts`의 지정 ID의 `imagePath`만 바꾼다. 기존 해시 이미지 삭제, 직업 일러스트 자동 덮어쓰기 및 무관한 파일 수정을 금지한다.
4. 기존 외형의 소유권, 수집 보상, ID, 등급, 거래 가능 여부 및 설명은 그대로 유지한다. 새 외형일 경우 이름, 등급, 이미지 및 기존 계약에 맞는 필수 필드를 등록한다.
5. `node --import ./tests/register.mjs --test tests/appearanceCatalog.test.ts`, `npm run typecheck`, `npm run build`로 검증한다. 가능하면 `node --test tests/skinPrGuard.test.mjs`도 확인한다.
6. 해당 외형 카탈로그와 새 WebP 파일 **두 개만 선택적으로 커밋**한다. 원격 `skin/*` 브랜치에 푸시하여 제목이 `skin-ready: <id>`인 PR을 만든다 (기존 `skin-ready` 레이블도 허용). `git add -A`, `git push origin main`, 강제 푸시 금지.
7. `.github/workflows/skin-pr-merge.yml`이 PR 범위, SHA-256 파일명, 메타데이터 불변성, 병합 미리보기 테스트 및 빌드를 검증한 뒤 순차 병합한다. 충돌이나 오류가 있으면 최신 `main`을 바탕으로 **해당 ID 변경만** 다시 준비한다. 다른 세션의 카탈로그 항목을 덮어쓰지 않는다.
8. 병합 커밋과 GitHub CI/Pages 결과 및 운영 사이트의 에셋 URL을 확인한 다음에만 완료로 보고한다. PR 생성이나 성공적인 커밋은 배포 완료가 아니다.

## 확인 사항
- 기본(default) 외형 이미지는 일반 해시 이미지 경로와 달라 이 PR 자동 큐에서 처리하지 않는다. 별도 작업으로 검증한다.
- 교체 전 이미지가 기존 빌드/캐시에 참조될 수 있으므로 삭제하지 않는다.
- 다른 세션이 같은 `cosmetics.ts` 인접 영역을 편집하면 Git 충돌이 날 수 있으며 **자동 해소는 미구현**이다. 충돌 PR을 작업한 세션이 최신 `main`에서 단일 ID만 재적용해야 한다.
- 브랜치 보호·GitHub 네이티브 병합 대기열 등 관리자 설정은 `docs/skin-parallel-deployment.md`를 따른다.
