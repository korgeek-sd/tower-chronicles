import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANK_CONSTANTS,
  type LoanDurationDays,
} from '../src/game/bank/types';
import {
  applyLoan,
  createBank,
  getOrCreateProfile,
  initialBankSystemState,
  isPlayerPenalized,
  processBankTick,
  repayLoan,
  settleDefault,
} from '../src/game/bank/service';
import {
  ensureTestSilverGrant,
  resetTestSilverGrant,
  TEST_BANK_SILVER_GRANT,
  TEST_BANK_GRANT_STORAGE_KEY,
} from '../src/game/bank/testGrant';
import { initialState } from '../src/game/engine/state';

const DAY_MS = 24 * 60 * 60 * 1000;

test('BANK 01: 은행 설립 - 프리미엄 계정 검증 및 자본금/이율 규칙', () => {
  const state = initialBankSystemState();
  const now = 1000000;

  // 비 프리미엄 계정은 설립 불가
  const nonPremium = createBank(state, {
    ownerId: 'user_1',
    ownerName: '플레이어1',
    bankName: '제1은행',
    vaultSilver: 5_000_000,
    interestRate: 10,
    supportedDurations: [5, 10, 15, 30],
    isPremium: false,
    now,
  });
  assert.equal(nonPremium.success, false);
  assert.match((nonPremium as any).reason, /프리미엄/);

  // 최소 자본금 미달 거부
  const lowVault = createBank(state, {
    ownerId: 'user_1',
    ownerName: '플레이어1',
    bankName: '제1은행',
    vaultSilver: 500_000,
    interestRate: 10,
    supportedDurations: [5, 10],
    isPremium: true,
    now,
  });
  assert.equal(lowVault.success, false);
  assert.match((lowVault as any).reason, /최소 설립 자본금/);

  // 정상 설립
  const success = createBank(state, {
    ownerId: 'user_1',
    ownerName: '플레이어1',
    bankName: '노바르 상업은행',
    vaultSilver: 5_000_000,
    interestRate: 10,
    supportedDurations: [5, 10, 15, 30],
    isPremium: true,
    now,
  });
  assert.equal(success.success, true);
  if (success.success) {
    assert.equal(success.bank.vaultSilver, 5_000_000);
    assert.equal(success.bank.interestRate, 10);
    assert.deepEqual(success.bank.supportedDurations, [5, 10, 15, 30]);
  }

  // 중복 설립 방지
  const duplicate = createBank(state, {
    ownerId: 'user_1',
    ownerName: '플레이어1',
    bankName: '제2은행',
    vaultSilver: 2_000_000,
    interestRate: 10,
    supportedDurations: [5],
    isPremium: true,
    now,
  });
  assert.equal(duplicate.success, false);
  assert.match((duplicate as any).reason, /이미 운영 중인/);
});

test('BANK 02: 담보 대출 신청 - 도전권 담보 및 원자적 처리', () => {
  const state = initialBankSystemState();
  const now = 1000000;

  // 은행 설립
  const bankResult = createBank(state, {
    ownerId: 'banker',
    ownerName: '은행장',
    bankName: '황금은행',
    vaultSilver: 10_000_000,
    interestRate: 10,
    supportedDurations: [5, 10, 15, 30],
    isPremium: true,
    now,
  });
  assert.equal(bankResult.success, true);
  const bank = (bankResult as any).bank;

  // 자신의 은행에서 대출 시도 차단
  const selfLoan = applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'banker',
    borrowerName: '은행장',
    collateralTickets: 2,
    durationDays: 5,
    borrowerAvailableTickets: 10,
    now,
  });
  assert.equal(selfLoan.success, false);
  assert.match((selfLoan as any).reason, /자신의 은행/);

  // 담보 도전권 부족 거부
  const shortTickets = applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'borrower_1',
    borrowerName: '대출자1',
    collateralTickets: 5,
    durationDays: 5,
    borrowerAvailableTickets: 3,
    now,
  });
  assert.equal(shortTickets.success, false);
  assert.match((shortTickets as any).reason, /도전권이 부족/);

  // 정상 대출 (도전권 2장 담보)
  // 1장당 50,000 Silver -> 원금 100,000 Silver, 이자 10% = 10,000 Silver, 총 상환액 110,000 Silver
  const loanResult = applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'borrower_1',
    borrowerName: '대출자1',
    collateralTickets: 2,
    durationDays: 10,
    borrowerAvailableTickets: 5,
    now,
  });
  assert.equal(loanResult.success, true);
  if (loanResult.success) {
    assert.equal(loanResult.silverPayout, 100_000);
    assert.equal(loanResult.ticketsCharged, 2);
    assert.equal(loanResult.loan.principalSilver, 100_000);
    assert.equal(loanResult.loan.interestSilver, 10_000);
    assert.equal(loanResult.loan.totalDueSilver, 110_000);
    assert.equal(loanResult.loan.durationDays, 10);
    assert.equal(loanResult.loan.maturityAt, now + 10 * DAY_MS);
    assert.equal(loanResult.loan.graceExpiryAt, now + 10 * DAY_MS + 24 * 60 * 60 * 1000);
    assert.equal(loanResult.loan.status, 'ACTIVE');

    // 은행 금고에서 원금 차감 확인
    assert.equal(state.banks[bank.id].vaultSilver, 9_900_000);
  }
});

test('BANK 03: 만기 일시상환 및 중도상환 불가 규칙', () => {
  const state = initialBankSystemState();
  const now = 1000000;

  const bankResult = createBank(state, {
    ownerId: 'banker',
    ownerName: '은행장',
    bankName: '중도상환테스트은행',
    vaultSilver: 5_000_000,
    interestRate: 8,
    supportedDurations: [5, 10],
    isPremium: true,
    now,
  });
  const bank = (bankResult as any).bank;

  const loanResult = applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'borrower_2',
    borrowerName: '대출자2',
    collateralTickets: 4, // 200,000 Silver
    durationDays: 5,
    borrowerAvailableTickets: 10,
    now,
  });
  assert.equal(loanResult.success, true);
  const loan = (loanResult as any).loan;

  // 만기(now + 5일) 이전 상환 시도: 중도상환 불가로 거부되어야 함
  const earlyRepay = repayLoan(state, {
    loanId: loan.id,
    borrowerSilver: 500_000,
    now: now + 3 * DAY_MS, // 3일 경과 시점
  });
  assert.equal(earlyRepay.success, false);
  assert.match((earlyRepay as any).reason, /중도상환/);

  // 만기 시점 잔액 부족 시 상환 거부
  const shortSilver = repayLoan(state, {
    loanId: loan.id,
    borrowerSilver: 100_000, // 원리금 216,000 필요
    now: loan.maturityAt,
  });
  assert.equal(shortSilver.success, false);
  assert.match((shortSilver as any).reason, /Silver가 부족/);

  // 만기 시점 정상 상환 (원금 200,000 + 이자 8% = 216,000 Silver)
  const successRepay = repayLoan(state, {
    loanId: loan.id,
    borrowerSilver: 300_000,
    now: loan.maturityAt,
  });
  assert.equal(successRepay.success, true);
  if (successRepay.success) {
    assert.equal(successRepay.silverDeducted, 216_000);
    assert.equal(successRepay.ticketsReturned, 4); // 담보 도전권 4장 반환
    assert.equal(state.loans[loan.id].status, 'REPAID');
    // 은행 금고에 원리금 입금 확인 (5,000,000 - 200,000 + 216,000 = 5,016,000)
    assert.equal(state.banks[bank.id].vaultSilver, 5_016_000);
    assert.equal(state.banks[bank.id].stats.totalInterestEarned, 16_000);
  }
});

test('BANK 04: 시간 경과 자동 상환 및 24시간 유예기간 독촉 4회 처리', () => {
  const state = initialBankSystemState();
  const startTime = 1000000;

  const bankResult = createBank(state, {
    ownerId: 'banker',
    ownerName: '은행장',
    bankName: '유예은행',
    vaultSilver: 5_000_000,
    interestRate: 10,
    supportedDurations: [5],
    isPremium: true,
    now: startTime,
  });
  const bank = (bankResult as any).bank;

  // 1. 만기 시 자동 상환되는 유저
  const loan1 = (applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'rich_user',
    borrowerName: '부유한유저',
    collateralTickets: 1,
    durationDays: 5,
    borrowerAvailableTickets: 5,
    now: startTime,
  }) as any).loan;

  // 2. 만기 시 잔액이 부족한 유저
  const loan2 = (applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'poor_user',
    borrowerName: '가난한유저',
    collateralTickets: 1,
    durationDays: 5,
    borrowerAvailableTickets: 5,
    now: startTime,
  }) as any).loan;

  const maturityTime = startTime + 5 * DAY_MS;

  // 만기 시점에 processBankTick 실행
  const tick1 = processBankTick(state, maturityTime, (id) => (id === 'rich_user' ? 200_000 : 0));
  assert.deepEqual(tick1.repaidLoans, [loan1.id]); // 부유한 유저는 자동 상환
  assert.equal(state.loans[loan1.id].status, 'REPAID');

  // 가난한 유저는 GRACE_PERIOD 진입 + 즉시 1차 독촉
  assert.equal(state.loans[loan2.id].status, 'GRACE_PERIOD');
  assert.equal(state.loans[loan2.id].remindersSent, 1);
  assert.deepEqual(tick1.remindedLoans, [loan2.id]);
  const poorProfile = state.profiles['poor_user'];
  assert.equal(poorProfile.notifications.length, 1);
  assert.equal(poorProfile.notifications[0].kind, 'REMINDER');

  // 유예기간 6시간 경과: 독촉 2회차
  const tick2 = processBankTick(state, maturityTime + 6 * 60 * 60 * 1000, () => 0);
  assert.deepEqual(tick2.remindedLoans, [loan2.id]);
  assert.equal(state.loans[loan2.id].remindersSent, 2);

  // 유예기간 12시간 경과: 독촉 3회차
  const tick3 = processBankTick(state, maturityTime + 12 * 60 * 60 * 1000, () => 0);
  assert.deepEqual(tick3.remindedLoans, [loan2.id]);
  assert.equal(state.loans[loan2.id].remindersSent, 3);

  // 유예기간 18시간 경과: 독촉 4회차 (최대 4회 완료)
  const tick4 = processBankTick(state, maturityTime + 18 * 60 * 60 * 1000, () => 0);
  assert.deepEqual(tick4.remindedLoans, [loan2.id]);
  assert.equal(state.loans[loan2.id].remindersSent, 4);

  // 4회 독촉 완료 후에는 추가 독촉 없음 (예: 20시간 시점)
  const tick5 = processBankTick(state, maturityTime + 20 * 60 * 60 * 1000, () => 0);
  assert.deepEqual(tick5.remindedLoans, []);
});

test('BANK 05: 미상환 처리 - 담보 귀속 + 채무 소멸 + 15일 신규 대출 금지 제재', () => {
  const state = initialBankSystemState();
  const startTime = 1000000;

  const bankResult = createBank(state, {
    ownerId: 'banker',
    ownerName: '은행장',
    bankName: '제재은행',
    vaultSilver: 5_000_000,
    interestRate: 10,
    supportedDurations: [5],
    isPremium: true,
    now: startTime,
  });
  const bank = (bankResult as any).bank;

  const loan = (applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'defaulter',
    borrowerName: '미상환자',
    collateralTickets: 3, // 150,000 Silver
    durationDays: 5,
    borrowerAvailableTickets: 5,
    now: startTime,
  }) as any).loan;

  // 유예기간 만료 시점: 5일 만기 + 24시간
  const graceExpiry = loan.graceExpiryAt;

  // processBankTick으로 유예 만료 처리
  state.loans[loan.id].status = 'GRACE_PERIOD';
  const tick = processBankTick(state, graceExpiry + 1, () => 0);
  assert.deepEqual(tick.defaultedLoans, [loan.id]);

  // 1. 담보 도전권 전량이 은행 금고로 귀속 확인
  assert.equal(state.banks[bank.id].collateralTicketsVault, 3);
  assert.equal(state.banks[bank.id].stats.totalDefaultedTickets, 3);

  // 2. 채무 소멸 및 상태 DEFAULTED 확인
  assert.equal(state.loans[loan.id].status, 'DEFAULTED');
  assert.equal(state.profiles['defaulter'].activeLoanIds.length, 0);

  // 3. 15일 동안 모든 은행에서 신규 대출 금지 제재 확인
  const defaulterProfile = state.profiles['defaulter'];
  assert.ok(defaulterProfile.penaltyUntil);
  assert.equal(isPlayerPenalized(defaulterProfile, graceExpiry + 1), true);

  // 제재 기간 중 다른 은행에서도 신규 대출 차단 확인
  const newLoanAttempt = applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'defaulter',
    borrowerName: '미상환자',
    collateralTickets: 1,
    durationDays: 5,
    borrowerAvailableTickets: 10,
    now: graceExpiry + 5 * DAY_MS, // 5일 후 (여전히 15일 제재 이내)
  });
  assert.equal(newLoanAttempt.success, false);
  assert.match((newLoanAttempt as any).reason, /제재 기간/);

  // 15일 경과 후 제재 해제 확인
  const after15Days = defaulterProfile.penaltyUntil + 1000;
  assert.equal(isPlayerPenalized(defaulterProfile, after15Days), false);

  const allowedLoan = applyLoan(state, {
    bankId: bank.id,
    borrowerId: 'defaulter',
    borrowerName: '미상환자',
    collateralTickets: 1,
    durationDays: 5,
    borrowerAvailableTickets: 10,
    now: after15Days,
  });
  assert.equal(allowedLoan.success, true);
});

test('BANK 06: 은행 설립 테스트 지원금 (10,000,000 Silver) 지급, 멱등성 및 리셋 검증', () => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  try {
    const baseState = initialState();
    assert.equal(baseState.silver, 0);

    // 1. 첫 호출 시 10,000,000 Silver 지급 및 골드/프리미엄 세팅
    const granted = ensureTestSilverGrant(baseState, 'test_user_1');
    assert.equal(granted.silver, TEST_BANK_SILVER_GRANT);
    assert.ok((granted.goldenRecorder?.expiresAt ?? 0) > Date.now());
    assert.ok((granted.market?.gold ?? 0) >= 1000);
    assert.match(granted.notice, /10,000,000 Silver/);

    // 2. 멱등성: 동일 계정에 대해 다시 호출 시 중복 지급되지 않음
    const doubleCall = ensureTestSilverGrant(granted, 'test_user_1');
    assert.equal(doubleCall.silver, TEST_BANK_SILVER_GRANT);

    // 3. 다른 계정은 독립적으로 지급 받음
    const user2 = ensureTestSilverGrant(baseState, 'test_user_2');
    assert.equal(user2.silver, TEST_BANK_SILVER_GRANT);

    // 4. 리셋 기능 검증: 지원금 회수 및 플래그 제거
    const reset = resetTestSilverGrant(granted, 'test_user_1');
    assert.equal(reset.silver, 0);
    assert.equal(store.has(`${TEST_BANK_GRANT_STORAGE_KEY}:test_user_1`), false);

    // 리셋 후 다시 지급 요청 시 다시 지급 가능
    const reGranted = ensureTestSilverGrant(reset, 'test_user_1');
    assert.equal(reGranted.silver, TEST_BANK_SILVER_GRANT);
  } finally {
    delete (globalThis as any).localStorage;
  }
});

