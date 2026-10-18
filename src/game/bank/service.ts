/**
 * 《탑의 기록 (Tower Chronicles)》 플레이어 운영 은행 비즈니스 로직 서비스
 * 기획서 11장 명세 준수
 */

import {
  BANK_CONSTANTS,
  type BankLoan,
  type BankNotification,
  type BankSystemState,
  type LoanDurationDays,
  type PlayerBank,
  type PlayerBankProfile,
  SUPPORTED_LOAN_DURATIONS,
} from './types';

export function initialBankSystemState(): BankSystemState {
  return {
    banks: {},
    loans: {},
    profiles: {},
  };
}

export function getOrCreateProfile(state: BankSystemState, userId: string): PlayerBankProfile {
  if (!state.profiles[userId]) {
    state.profiles[userId] = {
      userId,
      penaltyUntil: null,
      activeLoanIds: [],
      ownedBankId: null,
      notifications: [],
    };
  }
  return state.profiles[userId];
}

/** 15일 대출 금지 제재 유효 여부 판정 */
export function isPlayerPenalized(profile: PlayerBankProfile, now: number): boolean {
  if (!profile.penaltyUntil) return false;
  return now < profile.penaltyUntil;
}

/**
 * 11-1. 은행 설립
 * - 프리미엄 활성 계정만 설립 가능
 * - 대출 이율(%) 및 지원 대출 기간 설정
 */
export function createBank(
  state: BankSystemState,
  params: {
    ownerId: string;
    ownerName: string;
    bankName: string;
    vaultSilver: number;
    interestRate: number;
    supportedDurations: LoanDurationDays[];
    isPremium: boolean;
    now: number;
  }
): { success: true; bank: PlayerBank } | { success: false; reason: string } {
  if (!params.isPremium) {
    return { success: false, reason: '은행 설립은 프리미엄 계정 전용 혜택입니다.' };
  }

  const profile = getOrCreateProfile(state, params.ownerId);
  if (profile.ownedBankId && state.banks[profile.ownedBankId]?.active) {
    return { success: false, reason: '이미 운영 중인 은행이 있습니다.' };
  }

  if (params.vaultSilver < BANK_CONSTANTS.MIN_FOUNDING_VAULT_SILVER) {
    return {
      success: false,
      reason: `최소 설립 자본금은 ${BANK_CONSTANTS.MIN_FOUNDING_VAULT_SILVER.toLocaleString()} Silver입니다.`,
    };
  }

  if (
    params.interestRate < BANK_CONSTANTS.MIN_INTEREST_RATE ||
    params.interestRate > BANK_CONSTANTS.MAX_INTEREST_RATE
  ) {
    return {
      success: false,
      reason: `이율은 ${BANK_CONSTANTS.MIN_INTEREST_RATE}% ~ ${BANK_CONSTANTS.MAX_INTEREST_RATE}% 사이여야 합니다.`,
    };
  }

  if (!params.supportedDurations.length || !params.supportedDurations.every(d => SUPPORTED_LOAN_DURATIONS.includes(d))) {
    return { success: false, reason: '지원 대출 기간은 5일, 10일, 15일, 30일 중에서 선택해야 합니다.' };
  }

  const bankId = `bank_${params.ownerId}_${params.now}`;
  const bank: PlayerBank = {
    id: bankId,
    ownerId: params.ownerId,
    ownerName: params.ownerName,
    bankName: params.bankName.trim() || `${params.ownerName}의 은행`,
    vaultSilver: params.vaultSilver,
    collateralTicketsVault: 0,
    interestRate: params.interestRate,
    supportedDurations: params.supportedDurations,
    active: true,
    createdAt: params.now,
    stats: {
      totalLoansIssued: 0,
      totalPrincipalLent: 0,
      totalInterestEarned: 0,
      totalDefaultedLoans: 0,
      totalDefaultedTickets: 0,
    },
  };

  state.banks[bankId] = bank;
  profile.ownedBankId = bankId;

  return { success: true, bank };
}

/**
 * 11-2. 담보 대출 신청
 * - 대출 담보는 도전권이다.
 * - 중도상환 불가, 만기 일시상환
 */
export function applyLoan(
  state: BankSystemState,
  params: {
    bankId: string;
    borrowerId: string;
    borrowerName: string;
    collateralTickets: number;
    durationDays: LoanDurationDays;
    borrowerAvailableTickets: number;
    now: number;
  }
): {
  success: true;
  loan: BankLoan;
  silverPayout: number;
  ticketsCharged: number;
} | { success: false; reason: string } {
  const profile = getOrCreateProfile(state, params.borrowerId);

  // 미상환 제재 여부 확인
  if (isPlayerPenalized(profile, params.now)) {
    const remainingDays = Math.ceil((profile.penaltyUntil! - params.now) / (24 * 60 * 60 * 1000));
    return { success: false, reason: `미상환 제재 기간 중입니다. (${remainingDays}일 후 대출 가능)` };
  }

  const bank = state.banks[params.bankId];
  if (!bank || !bank.active) {
    return { success: false, reason: '존재하지 않거나 운영이 중단된 은행입니다.' };
  }

  if (bank.ownerId === params.borrowerId) {
    return { success: false, reason: '자신의 은행에서는 대출을 받을 수 없습니다.' };
  }

  if (!bank.supportedDurations.includes(params.durationDays)) {
    return { success: false, reason: '해당 은행에서 지원하지 않는 대출 기간입니다.' };
  }

  if (params.collateralTickets <= 0) {
    return { success: false, reason: '담보 도전권 수량은 1장 이상이어야 합니다.' };
  }

  if (params.borrowerAvailableTickets < params.collateralTickets) {
    return { success: false, reason: '보유한 도전권이 부족합니다.' };
  }

  const principalSilver = params.collateralTickets * BANK_CONSTANTS.TICKET_COLLATERAL_VALUE;

  if (bank.vaultSilver < principalSilver) {
    return { success: false, reason: '은행의 대출 자금이 부족합니다.' };
  }

  // 이자 계산 (단리 일시상환, 소수점 버림)
  const interestSilver = Math.floor(principalSilver * (bank.interestRate / 100));
  const totalDueSilver = principalSilver + interestSilver;

  const durationMs = params.durationDays * 24 * 60 * 60 * 1000;
  const maturityAt = params.now + durationMs;
  const graceExpiryAt = maturityAt + BANK_CONSTANTS.GRACE_PERIOD_MS;

  const loanId = `loan_${params.borrowerId}_${params.now}`;
  const loan: BankLoan = {
    id: loanId,
    bankId: bank.id,
    bankName: bank.bankName,
    borrowerId: params.borrowerId,
    borrowerName: params.borrowerName,
    collateralTickets: params.collateralTickets,
    principalSilver,
    interestRate: bank.interestRate,
    interestSilver,
    totalDueSilver,
    durationDays: params.durationDays,
    issuedAt: params.now,
    maturityAt,
    graceExpiryAt,
    status: 'ACTIVE',
    remindersSent: 0,
    lastReminderAt: null,
    repaidAt: null,
    defaultedAt: null,
  };

  // 원자적 은행 금고 차감 및 대출 등록
  bank.vaultSilver -= principalSilver;
  bank.stats.totalLoansIssued += 1;
  bank.stats.totalPrincipalLent += principalSilver;

  state.loans[loanId] = loan;
  profile.activeLoanIds.push(loanId);

  return {
    success: true,
    loan,
    silverPayout: principalSilver,
    ticketsCharged: params.collateralTickets,
  };
}

/**
 * 11-2. 만기 일시상환
 * - 중도상환 불가 (만기 이전 상환 시도 차단)
 * - 원리금 전액 보유 확인 후 원자적 차감 및 담보 반환
 */
export function repayLoan(
  state: BankSystemState,
  params: {
    loanId: string;
    borrowerSilver: number;
    now: number;
  }
): {
  success: true;
  silverDeducted: number;
  ticketsReturned: number;
} | { success: false; reason: string } {
  const loan = state.loans[params.loanId];
  if (!loan) {
    return { success: false, reason: '대출 정보를 찾을 수 없습니다.' };
  }

  if (loan.status === 'REPAID') {
    return { success: false, reason: '이미 상환 완료된 대출입니다.' };
  }

  if (loan.status === 'DEFAULTED') {
    return { success: false, reason: '이미 담보가 귀속되어 채무가 소멸된 계약입니다.' };
  }

  // 중도상환 불가 체크 (확정 규칙)
  if (params.now < loan.maturityAt) {
    return { success: false, reason: '만기 이전에 중도상환할 수 없습니다. (만기 일시상환)' };
  }

  if (params.borrowerSilver < loan.totalDueSilver) {
    return { success: false, reason: '상환에 필요한 Silver가 부족합니다.' };
  }

  const bank = state.banks[loan.bankId];
  if (bank) {
    bank.vaultSilver += loan.totalDueSilver;
    bank.stats.totalInterestEarned += loan.interestSilver;
  }

  loan.status = 'REPAID';
  loan.repaidAt = params.now;

  const profile = getOrCreateProfile(state, loan.borrowerId);
  profile.activeLoanIds = profile.activeLoanIds.filter(id => id !== loan.id);

  return {
    success: true,
    silverDeducted: loan.totalDueSilver,
    ticketsReturned: loan.collateralTickets,
  };
}

/**
 * 11-3. 미상환 처리
 * 유예기간 종료 시에도 상환되지 못한 대출의 담보 귀속 및 채무 소멸, 15일 제재 적용
 */
export function settleDefault(
  state: BankSystemState,
  loanId: string,
  now: number
): { success: true; ticketsForfeited: number } | { success: false; reason: string } {
  const loan = state.loans[loanId];
  if (!loan || loan.status === 'REPAID' || loan.status === 'DEFAULTED') {
    return { success: false, reason: '처리할 수 없는 대출 상태입니다.' };
  }

  loan.status = 'DEFAULTED';
  loan.defaultedAt = now;

  const bank = state.banks[loan.bankId];
  if (bank) {
    // 1. 담보로 맡긴 도전권 전량을 은행에 귀속
    bank.collateralTicketsVault += loan.collateralTickets;
    bank.stats.totalDefaultedLoans += 1;
    bank.stats.totalDefaultedTickets += loan.collateralTickets;
  }

  const profile = getOrCreateProfile(state, loan.borrowerId);
  // 2. 담보 귀속과 동시에 남아 있는 채무 소멸 (활성 목록에서 제거)
  profile.activeLoanIds = profile.activeLoanIds.filter(id => id !== loan.id);

  // 3. 15일 동안 모든 은행에서 신규 대출 금지 제재 부여
  profile.penaltyUntil = now + BANK_CONSTANTS.DEFAULT_PENALTY_MS;

  const notification: BankNotification = {
    id: `notif_${loan.id}_default_${now}`,
    loanId: loan.id,
    kind: 'DEFAULTED',
    message: `대출 유예기간이 종료되어 담보 도전권(${loan.collateralTickets}장)이 은행에 귀속되고 채무가 소멸되었습니다. 향후 15일간 대출이 제한됩니다.`,
    createdAt: now,
    read: false,
  };
  profile.notifications.push(notification);

  return { success: true, ticketsForfeited: loan.collateralTickets };
}

/**
 * 시간 경과에 따른 만기 확인, 자동 상환 시도, 유예기간 전환, 독촉 발송 처리
 */
export function processBankTick(
  state: BankSystemState,
  now: number,
  getBorrowerSilver: (borrowerId: string) => number,
  onAutoRepay?: (loan: BankLoan) => void
): {
  repaidLoans: string[];
  remindedLoans: string[];
  defaultedLoans: string[];
} {
  const repaidLoans: string[] = [];
  const remindedLoans: string[] = [];
  const defaultedLoans: string[] = [];

  for (const loan of Object.values(state.loans)) {
    if (loan.status === 'REPAID' || loan.status === 'DEFAULTED') continue;

    // 만기 시점 도달
    if (loan.status === 'ACTIVE' && now >= loan.maturityAt) {
      const borrowerSilver = getBorrowerSilver(loan.borrowerId);
      if (borrowerSilver >= loan.totalDueSilver) {
        // 만기 시 보유 실버가 충분하면 자동 상환
        const result = repayLoan(state, { loanId: loan.id, borrowerSilver, now });
        if (result.success) {
          repaidLoans.push(loan.id);
          onAutoRepay?.(loan);
          continue;
        }
      }

      // 잔액 부족 시 유예기간 진입 및 1회차 독촉 발송
      loan.status = 'GRACE_PERIOD';
      loan.remindersSent = 1;
      loan.lastReminderAt = now;
      const profile = getOrCreateProfile(state, loan.borrowerId);
      profile.notifications.push({
        id: `notif_${loan.id}_grace_${now}`,
        loanId: loan.id,
        kind: 'REMINDER',
        message: `[대출 상환 독촉 1/4회] 대출 만기가 도래하였으나 잔액이 부족합니다. 24시간의 유예기간이 시작되었습니다. 유예기간 만료 전 상환하지 않을 경우 담보 도전권이 귀속되고 15일간 대출이 제한됩니다.`,
        createdAt: now,
        read: false,
      });
      remindedLoans.push(loan.id);
      continue;
    }

    // 유예기간 중 독촉 처리 (24시간 동안 6시간마다 최대 4회)
    if (loan.status === 'GRACE_PERIOD') {
      const shouldRemind =
        loan.remindersSent < BANK_CONSTANTS.MAX_REMINDERS &&
        (!loan.lastReminderAt || now - loan.lastReminderAt >= BANK_CONSTANTS.REMINDER_INTERVAL_MS);

      if (shouldRemind) {
        loan.remindersSent += 1;
        loan.lastReminderAt = now;
        remindedLoans.push(loan.id);

        const profile = getOrCreateProfile(state, loan.borrowerId);
        profile.notifications.push({
          id: `notif_${loan.id}_remind_${loan.remindersSent}_${now}`,
          loanId: loan.id,
          kind: 'REMINDER',
          message: `[대출 상환 독촉 ${loan.remindersSent}/4회] 유예기간 만료 전 상환하지 않을 경우 담보 도전권이 귀속되고 15일간 대출이 금지됩니다.`,
          createdAt: now,
          read: false,
        });
      }

      // 유예기간 종료 시 미상환 확정 처리
      if (now >= loan.graceExpiryAt) {
        settleDefault(state, loan.id, now);
        defaultedLoans.push(loan.id);
      }
    }
  }

  return { repaidLoans, remindedLoans, defaultedLoans };
}
