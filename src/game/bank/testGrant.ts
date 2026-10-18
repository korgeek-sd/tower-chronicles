import type { GameState } from '../types';
import { createBank, initialBankSystemState } from './service';
import type { BankSystemState } from './types';

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

// ─── 테스트 은행 시드 ────────────────────────────────────────────────────────
/** 임의 생성 테스트 은행의 고정 ownerID (실제 플레이어 userId와 절대 겹치지 않도록 특수 접두사 사용) */
export const TEST_BANK_OWNER_ID = 'tc_sys_test_bank_v1';
/** 테스트 은행 시드 완료 플래그 키 (계정 무관 전역 — 모든 플레이어가 동일 은행을 이용) */
export const TEST_BANK_SEED_KEY = 'tc_test_bank_seeded_v1';

/**
 * 전역 테스트 은행 「노바르 시범 대출소」를 BankSystemState에 멱등적으로 삽입한다.
 * - ownerId가 실제 플레이어 userId와 다르므로 어느 계정이든 대출자(borrower)로 이용 가능
 * - localStorage 플래그 기반 멱등성: 이미 생성된 경우 그대로 반환
 * - 브라우저 환경이 아닌 경우(SSR/테스트) 에러 없이 상태 반환
 */
export function ensureTestBankExists(bankState: BankSystemState): BankSystemState {
  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    // 이미 시드된 경우 — bankState에 해당 은행이 살아있으면 그냥 반환
    const alreadySeeded = storage?.getItem(TEST_BANK_SEED_KEY) === 'true';
    const bankAlreadyInState = Object.values(bankState.banks).some(
      (b) => b.ownerId === TEST_BANK_OWNER_ID && b.active
    );
    if (alreadySeeded && bankAlreadyInState) return bankState;

    // 상태를 얕게 복사 후 createBank 호출 (mutating API)
    const next: BankSystemState = {
      banks: { ...bankState.banks },
      loans: { ...bankState.loans },
      profiles: { ...bankState.profiles },
    };

    // 이미 ownerId 프로필이 있고 은행도 active인 경우 플래그만 세팅 후 반환
    const existingProfile = next.profiles[TEST_BANK_OWNER_ID];
    if (existingProfile?.ownedBankId && next.banks[existingProfile.ownedBankId]?.active) {
      storage?.setItem(TEST_BANK_SEED_KEY, 'true');
      return next;
    }

    const result = createBank(next, {
      ownerId: TEST_BANK_OWNER_ID,
      ownerName: '탑 운영 시스템',
      bankName: '노바르 시범 대출소',
      vaultSilver: 50_000_000,   // 5,000만 Silver — 충분한 대출 재원
      interestRate: 10,           // 10% 이율
      supportedDurations: [5, 10, 15, 30],
      isPremium: true,            // 시스템 은행은 프리미엄 조건 면제
      now: 1_700_000_000_000,    // 고정 시각 — 매번 다른 bankId 생성 방지
    });

    if (result.success) {
      storage?.setItem(TEST_BANK_SEED_KEY, 'true');
      return next;
    }

    // createBank 실패 사유 콘솔 경고 후 원본 반환
    console.warn('[TestBank] ensureTestBankExists: 은행 생성 실패 —', result.reason);
    return bankState;
  } catch (e) {
    console.warn('[TestBank] ensureTestBankExists error:', e);
    return bankState;
  }
}

/**
 * 테스트 은행 시드 플래그를 초기화한다 (은행 자체는 bankState에서 직접 제거 필요).
 */
export function resetTestBank(): void {
  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    storage?.removeItem(TEST_BANK_SEED_KEY);
  } catch {
    // ignore
  }
}

/** 기존 bankState에서 테스트 은행을 제거하고 초기 상태를 반환하는 완전 리셋 헬퍼 */
export function purgeTestBank(bankState: BankSystemState): BankSystemState {
  resetTestBank();
  const next: BankSystemState = {
    banks: Object.fromEntries(
      Object.entries(bankState.banks).filter(([, b]) => b.ownerId !== TEST_BANK_OWNER_ID)
    ),
    loans: { ...bankState.loans },
    profiles: Object.fromEntries(
      Object.entries(bankState.profiles).filter(([id]) => id !== TEST_BANK_OWNER_ID)
    ),
  };
  return next;
}
