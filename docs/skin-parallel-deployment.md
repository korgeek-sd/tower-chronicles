# 외형 이미지 병렬 제작 및 순차 배포

## 동작 구조

- 각 ChatGPT 세션은 최신 `main`에서 자기 전용 `skin/<외형ID>-<고유작업식별자>` 브랜치를 만든다.
- 한 PR에는 `src/game/data/cosmetics.ts`의 외형 하나와 새 `public/assets/characters/appearances/<외형ID>-<SHA256앞12자리>.webp`만 포함한다. 이전 외형 이미지는 삭제하지 않는다.
- 외형 제작이 완료되면 `main` 대상 PR을 만들고 제목을 **`skin-ready: <외형ID>`**로 지정한다. `skin-ready` 레이블도 지원하지만 별도 생성할 필요는 없다.
- `.github/workflows/skin-pr-merge.yml`이 준비된 PR 이벤트와 10분 간격 재검사로 열린 PR 중 하나를 직렬 검증한다. 범위 검사 → 병합 미리보기 → 테스트 → 타입 검사 → 빌드 → GitHub PR 병합 순서다.
- 병합 성공 후 GitHub 토큰의 후속 push 워크플로 억제를 보완하기 위해 `ci.yml`과 `deploy-pages.yml`을 명시적으로 dispatch한다. Pages 성공과 실제 이미지 URL 확인 전에는 배포 완료라고 말하면 안 된다.

## 세션에서 실행할 절차

```bash
git fetch origin main
git switch -c skin/knight-20261021 origin/main
# 이미지 변환 및 해당 ID의 cosmetics.ts imagePath 갱신
git add src/game/data/cosmetics.ts public/assets/characters/appearances/knight-<hash>.webp
git commit -m "feat(skins): update knight artwork"
git push -u origin HEAD
gh pr create --base main --head "$(git branch --show-current)" --title "skin-ready: knight" --body "One isolated appearance update"
```

위 명령은 예시이며, 실제 ID 및 해시, 브랜치 중복을 확인해야 한다. 새 PR 제목의 `skin-ready:` 표식으로 큐가 자동 실행되며, 선택적인 `skin-ready` 레이블은 사전에 생성된 경우에만 사용한다.

## 충돌 및 재시도

서로 다른 외형이라도 `cosmetics.ts`의 같은 삽입 위치를 건드리면 일반 Git 3-way merge에서 충돌할 수 있다. 큐는 각 PR의 단일 외형 ID를 AST로 추출해 최신 `main` 카탈로그에 재적용하고, 기존 PR 브랜치에 강제 푸시 없는 병합 커밋을 추가한다. 기존의 다른 외형 항목은 그대로 유지한다. 같은 외형 ID가 양쪽에서 다르게 바뀌었거나 다른 파일이 충돌하면 중단하고 어느 이미지가 우선인지 결정해야 한다.

예상 실패: PR에서 다른 소스 수정 또는 파일 삭제 발견, WebP 해시 불일치, 동일 외형 이외의 메타데이터 변경, 병합 충돌, 테스트 실패, 병합 권한 부족, Pages 실패. 모든 실패는 명시적으로 보고하며 성공했다고 주장하지 않는다.

## GitHub 관리자 설정

이 저장소의 GitHub 커넥터는 브랜치 보호 규칙과 네이티브 merge queue를 변경하는 액션을 제공하지 않는다. 따라서 다음은 **수동 확인이 필요한 관리자 설정**이다.

1. GitHub 저장소 → **Settings → Rules → Rulesets** (또는 Branch protection rules)에서 `main` 보호 규칙을 만든다. PR을 통한 변경을 요구하고 강제 푸시 및 삭제를 차단한다.
2. 테스트가 처음 통과한 후 `Tower Chronicles CI / verify` 같은 정확한 상태 검사명을 확인하여 필수 검사로 지정한다. 잘못된 이름은 병합을 차단할 수 있다.
3. GitHub Actions의 워크플로 권한과 승인 정책에서 이 저장소의 `GITHUB_TOKEN`이 PR 병합·Actions dispatch를 수행할 수 있는지 확인한다. 브랜치 보호가 자동화 토큰의 병합까지 차단할 경우 적절한 병합 주체/권한을 별도로 구성해야 한다.
4. 네이티브 GitHub merge queue를 따로 켤 때는 `skin-pr-merge.yml`의 자동 병합과 중복 운영하지 않는다. 한 개의 병합 권한자만 선택한다.

## 안전 조건

- 각 세션의 브랜치 및 PR은 독립적이다.
- `scripts/skin-pr-guard.mjs`는 변경 목록과 카탈로그 AST를 검사하여 기존 외형/메타데이터 변경 및 구버전 에셋 삭제를 거부한다.
- 메인 병합 워크플로는 준비 표시 제목(`skin-ready:`) 또는 승인된 `skin-ready` 레이블이 있는 동일 저장소 브랜치에서만 동작한다. `main`에 바로 푸시하는 예전 스킬의 지침은 더 이상 사용하지 않는다.
- 현재 기본 모험가(`default`)는 예외이며 자동 큐에 포함하지 않는다.
- 실제 배포는 여러 개가 동시에 실행되는 것이 아니라 최종 코드가 순서대로 통합되고 Pages의 최신 배포에 반영되는 방식이다.
