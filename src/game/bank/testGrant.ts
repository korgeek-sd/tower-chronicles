import type { GameState } from '../types';

export const TEST_BANK_SILVER_GRANT = 10_000_000;
export const TEST_BANK_GRANT_STORAGE_KEY = 'tc_test_bank_silver_grant_10m_v1';

/**
 * 은행 설립 및 운영 테스트를 위한 10,000,000 Silver 임시 지급 헬퍼
 * - 현재 가입된 계정 및 로컬 플레이 계정에 10,000,000 Silver 씩 지급
 * - 중복 지급 방지(계정 식별자 기반)
 * - 황금의 기록서(프리미엄 30일) 활성화 지원
 * - 사용자 요청("나중에 리셋할거야")에 따라 리셋 시 손쉽게 회수/제거 가능하도록 분리 모듈화
 */
export function ensureTestSilverGrant(game: GameState, accountKey: string = 'guest'): GameState {
  try {
    const key = `${TEST_BANK_GRANT_STORAGE_KEY}:${accountKey}`;
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const alreadyGranted = storage?.getItem(key) === 'true';

    if (!alreadyGranted) {
      if (storage) {
        storage.setItem(key, 'true');
      }
      return {
        ...game,
        silver: (game.silver ?? 0) + TEST_BANK_SILVER_GRANT,
        goldenRecorder: {
          expiresAt: Math.max(game.goldenRecorder?.expiresAt ?? 0, Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        market: {
          ...game.market,
          gold: Math.max(game.market?.gold ?? 0, 1000),
        },
        notice: '은행 설립 테스트 지원금 10,000,000 Silver 및 프리미엄 혜택이 지급되었습니다.',
      };
    }
  } catch {
    // 스토리지 접근 불가 환경에서도 상태 반환
  }
  return game;
}

/**
 * 테스트 종료 후 지원금 회수 및 리셋 함수
 */
export function resetTestSilverGrant(game: GameState, accountKey: string = 'guest'): GameState {
  try {
    const key = `${TEST_BANK_GRANT_STORAGE_KEY}:${accountKey}`;
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    if (storage) {
      storage.removeItem(key);
    }
  } catch {
    // ignore
  }
  return {
    ...game,
    silver: Math.max(0, (game.silver ?? 0) - TEST_BANK_SILVER_GRANT),
    notice: '은행 설립 테스트 지원금이 회수되었습니다.',
  };
}
