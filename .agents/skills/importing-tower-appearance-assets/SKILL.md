---
name: importing-tower-appearance-assets
description: Use when a user provides an image to add, replace, or update a Tower Chronicles appearance (외형) character artwork.
---

# Importing Tower Appearance Assets (외형 이미지 등록 및 변경 스킬)

## 개요 (Overview)
사용자가 제공한 캐릭터 이미지(JPG, PNG 등)를 《탑의 기록》 외형 규격(1024×1024 WebP, 투명 배경, SHA-256 해시 명명 규칙)에 맞추어 **자동으로 변환하고 카탈로그에 즉시 등록·배포**하는 고속 파이프라인 스킬입니다.

이 스크립트 하나로 배경 투명화, WebP 변환, 해시 계산, `cosmetics.ts` 갱신, 직업 일러스트 동기화, 구버전 정리가 수 초 만에 일괄 처리됩니다.

---

## 초고속 작업 절차 (Fast Path)

### 1단계: 원클릭 자동 변환 스크립트 실행
사용자가 업로드한 이미지 경로와 대상 외형 ID(`corsair`, `slime`, `teddy`, `mechanic`, `proletaria` 등)를 확인한 후 아래 명령을 실행합니다:

```bash
node scripts/import-appearance.mjs <appearance-id> "<image-file-path>"
```

**스크립트 자동 처리 내역:**
1. **외곽 검은 배경 자동 투명화**: 모자, 장식 등 캐릭터 내부의 흑갈색 디테일은 유지하면서, 8방향 BFS Flood-Fill로 외곽 배경만 깨끗한 알파 투명 채널(`A = 0`)로 변환합니다.
2. **규격화 및 WebP 인코딩**: 1024×1024 해상도로 고화질 WebP 인코딩을 수행합니다.
3. **SHA-256 12자리 해시 산출**: 파일 내용 기반 12자리 해시(`[id]-[hash].webp`)를 생성합니다.
4. **외형 에셋 저장 및 구버전 삭제**: `public/assets/characters/appearances/<id>-<hash>.webp`로 저장하고, 이전 버전의 해시 파일은 디스크에서 자동 삭제합니다.
5. **직업 일러스트 자동 동기화**: `public/assets/characters/jobs/<id>.webp`가 존재하는 경우, 일관성을 위해 새 아트로 자동 동기화합니다.
6. **카탈로그 자동 업데이트**: `src/game/data/cosmetics.ts` 내 해당 외형의 `imagePath`를 새 파일명으로 자동 교체합니다.

---

### 2단계: 단위 테스트 검증
아래 집중 테스트를 실행하여 카탈로그 유효성과 에셋 연결을 검증합니다:

```bash
node --import ./tests/register.mjs --test tests/appearanceCatalog.test.ts
```

---

### 3단계: Git 커밋 및 푸시
```bash
git add -A
git commit -m "feat(cosmetics): update <appearance-id> appearance artwork"
git push origin main
```

---

### 4단계: 결과 보고
작업 완료 후 사용자에게 다음 사항을 간결하게 보고합니다:
- 대상 외형 이름 및 ID
- 생성된 WebP 파일 경로 및 해시
- Git 커밋 SHA
- GitHub Pages 배포 진행 상태

---

## 규격 체크리스트 (Definition of Done)
- [x] 해상도: 1024×1024 square canvas
- [x] 배경: 외곽 검은 배경이 투명화(Alpha = 0)되어 있는가
- [x] 파일명: `public/assets/characters/appearances/<id>-<hash12>.webp`
- [x] 카탈로그: `src/game/data/cosmetics.ts`의 `imagePath`와 일치하는가
- [x] 테스트: `appearanceCatalog.test.ts` 통과 확인
- [x] 원격 저장소: `main` 브랜치에 커밋 및 푸시 완료
