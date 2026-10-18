/**
 * 《탑의 기록 (Tower Chronicles)》 플레이어 운영 은행 시스템 데이터 타입
 * 기획서 11장: 플레이어 운영 은행 시스템
 */

export const SUPPORTED_LOAN_DURATIONS = [5, 10, 15, 30] as const;
export type LoanDurationDays = typeof SUPPORTED_LOAN_DURATIONS[number];

/** 유예기간 및 독촉 관련 상수 (기획서 11-2, 11-3 확정) */
export const BANK_CONSTANTS = {
  /** 도전권 1장당 담보 인정 가치 (Silver) */
  TICKET_COLLATERAL_VALUE: 50_000,
  /** 만기 후 유예기간: 24시간 */
  GRACE_PERIOD_MS: 24 * 60 * 60 * 1000,
  /** 독촉 주기: 6시간 */
  REMINDER_INTERVAL_MS: 6 * 60 * 60 * 1000,
  /** 최대 독촉 횟수: 4회 */
  MAX_REMINDERS: 4,
  /** 미상환 시 신규 대출 금지 제재 기간: 15일 */
  DEFAULT_PENALTY_DAYS: 15,
  DEFAULT_PENALTY_MS: 15 * 24 * 60 * 60 * 1000,
  /** 은행 설립 최소 자본금 (Silver) */
  MIN_FOUNDING_VAULT_SILVER: 1_000_000,
  /** 최소/최대 이율 (%) */
  MIN_INTEREST_RATE: 1,
  MAX_INTEREST_RATE: 50,
} as const;

/** 대출 계약 상태 */
export type LoanStatus =
  | 'ACTIVE'        // 정상 진행 중
  | 'GRACE_PERIOD' // 만기 도래 후 24시간 유예기간 진행 중
  | 'REPAID'       // 상환 완료
  | 'DEFAULTED';   // 유예기간 만료로 미상환 처리 (담보 귀속 및 채무 소멸)

/** 대출 계약 레코드 */
export interface BankLoan {
  id: string;
  bankId: string;
  bankName: string;
  borrowerId: string;
  borrowerName: string;
  /** 담보로 맡긴 도전권 수량 */
  collateralTickets: number;
  /** 대출 원금 (Silver) */
  principalSilver: number;
  /** 약정 이율 (%) */
  interestRate: number;
  /** 약정 이자 (Silver) - 만기 일시상환 시 부과 */
  interestSilver: number;
  /** 만기 총 상환액 (원금 + 이자) */
  totalDueSilver: number;
  /** 대출 기간 (5, 10, 15, 30일) */
  durationDays: LoanDurationDays;
  /** 대출 발생 시각 (ms) */
  issuedAt: number;
  /** 만기 시각 (ms = issuedAt + durationDays * 86,400,000) */
  maturityAt: number;
  /** 유예기간 만료 시각 (ms = maturityAt + 24시간) */
  graceExpiryAt: number;
  /** 대출 상태 */
  status: LoanStatus;
  /** 발송된 독촉 횟수 (0 ~ 4회) */
  remindersSent: number;
  /** 최근 독촉 발송 시각 (ms | null) */
  lastReminderAt: number | null;
  /** 상환 완료 시각 (ms | null) */
  repaidAt: number | null;
  /** 미상환 귀속 시각 (ms | null) */
  defaultedAt: number | null;
}

/** 은행 계좌 및 운영 정보 */
export interface PlayerBank {
  id: string;
  ownerId: string;
  ownerName: string;
  bankName: string;
  /** 은행 금고 보유 자금 (대출 재원, Silver) */
  vaultSilver: number;
  /** 미상환으로 귀속된 담보 도전권 보관 수량 */
  collateralTicketsVault: number;
  /** 은행장이 설정한 대출 이율 (%) */
  interestRate: number;
  /** 지원하는 대출 기간 목록 */
  supportedDurations: LoanDurationDays[];
  /** 활성화 여부 */
  active: boolean;
  /** 설립 일시 (ms) */
  createdAt: number;
  /** 통계 데이터 */
  stats: {
    totalLoansIssued: number;
    totalPrincipalLent: number;
    totalInterestEarned: number;
    totalDefaultedLoans: number;
    totalDefaultedTickets: number;
  };
}

/** 플레이어별 대출 및 은행 이용 프로필 */
export interface PlayerBankProfile {
  userId: string;
  /** 15일 대출 금지 제재 만료 시각 (null이면 제재 없음) */
  penaltyUntil: number | null;
  /** 현재 보유 중인 대출 ID 목록 */
  activeLoanIds: string[];
  /** 본인이 설립한 은행 ID (null이면 미설립) */
  ownedBankId: string | null;
  /** 수신된 독촉 알림 목록 */
  notifications: BankNotification[];
}

/** 은행 시스템 알림 (독촉 및 만기/귀속 통보) */
export interface BankNotification {
  id: string;
  loanId: string;
  kind: 'REMINDER' | 'MATURITY' | 'DEFAULTED' | 'REPAID';
  message: string;
  createdAt: number;
  read: boolean;
}

/** 은행 시스템 전역 상태 */
export interface BankSystemState {
  banks: Record<string, PlayerBank>;
  loans: Record<string, BankLoan>;
  profiles: Record<string, PlayerBankProfile>;
}
