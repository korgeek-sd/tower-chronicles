import React, { useState } from 'react';
import type { GameState } from '../../game/types';
import { Screen, Segments, Glyph } from '../../ui/mobile';
import {
  BANK_CONSTANTS,
  type BankLoan,
  type BankSystemState,
  type LoanDurationDays,
  type PlayerBank,
  SUPPORTED_LOAN_DURATIONS,
} from '../../game/bank/types';
import {
  applyLoan,
  createBank,
  getOrCreateProfile,
  isPlayerPenalized,
  repayLoan,
} from '../../game/bank/service';
import './bank.css';

interface Props {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState>>;
  bankState: BankSystemState;
  setBankState: React.Dispatch<React.SetStateAction<BankSystemState>>;
  userId?: string | null;
  userName?: string;
  isPremium: boolean;
  onOpenPremium?: () => void;
  now?: number;
  initialTab?: 'loans' | 'my' | 'manage';
}

export function BankScreen({
  game,
  setGame,
  bankState,
  setBankState,
  userId = 'guest_user',
  userName = '모험가',
  isPremium,
  onOpenPremium,
  now = Date.now(),
  initialTab = 'loans',
}: Props) {
  const currentUserId = userId || 'guest_user';
  const currentUserName = userName || '모험가';

  const [tab, setTab] = useState<'loans' | 'my' | 'manage'>(initialTab);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  // 대출 신청 입력 상태
  const [ticketInput, setTicketInput] = useState<number>(1);
  const [durationInput, setDurationInput] = useState<LoanDurationDays>(5);

  // 은행 설립 입력 상태
  const [newBankName, setNewBankName] = useState<string>('');
  const [newVaultSilver, setNewVaultSilver] = useState<number>(BANK_CONSTANTS.MIN_FOUNDING_VAULT_SILVER);
  const [newInterestRate, setNewInterestRate] = useState<number>(10);
  const [newDurations, setNewDurations] = useState<LoanDurationDays[]>([5, 10, 15, 30]);

  const [notice, setNotice] = useState<string>('');
  const [error, setError] = useState<string>('');

  const profile = getOrCreateProfile(bankState, currentUserId);
  const isPenalized = isPlayerPenalized(profile, now);

  // 보유 도전권 총합 계산 (철맥, 칼레온 등 모든 탑의 입장권/도전권)
  const availableTickets = Object.values(game.tickets).reduce(
    (acc, arr) => acc + (arr?.[0] ?? 0),
    0
  );

  const bankList = Object.values(bankState.banks).filter(b => b.active);
  const myLoans = Object.values(bankState.loans).filter(l => l.borrowerId === currentUserId);
  const myBank = profile.ownedBankId ? bankState.banks[profile.ownedBankId] : null;

  const formatDate = (ms: number) => {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ms);
  };

  // 대출 실행
  const handleApplyLoan = (bank: PlayerBank) => {
    setError('');
    setNotice('');
    const tickets = Number(ticketInput);
    if (!tickets || tickets < 1) {
      setError('담보 도전권 수량을 1장 이상 입력해 주세요.');
      return;
    }

    const nextState = { ...bankState };
    const result = applyLoan(nextState, {
      bankId: bank.id,
      borrowerId: currentUserId,
      borrowerName: currentUserName,
      collateralTickets: tickets,
      durationDays: durationInput,
      borrowerAvailableTickets: availableTickets,
      now,
    });

    if (!result.success) {
      setError(result.reason);
      return;
    }

    // 플레이어 재화 원자적 반영 (도전권 차감 및 실버 지급)
    setGame(prev => {
      // 첫 번째 탑(철맥 등)에서 티켓 차감
      let remainingToDeduct = tickets;
      const nextTickets = { ...prev.tickets };
      for (const tower of Object.keys(nextTickets) as (keyof typeof prev.tickets)[]) {
        const arr = [...(nextTickets[tower] ?? [0])];
        if (arr[0] > 0) {
          const deduct = Math.min(arr[0], remainingToDeduct);
          arr[0] -= deduct;
          remainingToDeduct -= deduct;
          nextTickets[tower] = arr;
        }
        if (remainingToDeduct <= 0) break;
      }

      return {
        ...prev,
        silver: prev.silver + result.silverPayout,
        tickets: nextTickets,
      };
    });

    setBankState(nextState);
    setNotice(
      `대출 완료: Silver +${result.silverPayout.toLocaleString()} 지급, 담보 도전권 ${tickets}장 예치`
    );
    setSelectedBankId(null);
  };

  // 대출 상환
  const handleRepayLoan = (loan: BankLoan) => {
    setError('');
    setNotice('');
    if (now < loan.maturityAt) {
      setError('중도상환 불가: 만기 시점에 일시상환할 수 있습니다.');
      return;
    }

    if (game.silver < loan.totalDueSilver) {
      setError(`Silver가 부족합니다. (필요: ${loan.totalDueSilver.toLocaleString()} Silver)`);
      return;
    }

    const nextState = { ...bankState };
    const result = repayLoan(nextState, {
      loanId: loan.id,
      borrowerSilver: game.silver,
      now,
    });

    if (!result.success) {
      setError(result.reason);
      return;
    }

    // 플레이어 재화 원자적 반영 (실버 차감 및 담보 도전권 반환)
    setGame(prev => {
      const nextTickets = { ...prev.tickets };
      const firstTower = (Object.keys(nextTickets)[0] ?? 'ore') as keyof typeof prev.tickets;
      const arr = [...(nextTickets[firstTower] ?? [0])];
      arr[0] = (arr[0] ?? 0) + result.ticketsReturned;
      nextTickets[firstTower] = arr;

      return {
        ...prev,
        silver: prev.silver - result.silverDeducted,
        tickets: nextTickets,
      };
    });

    setBankState(nextState);
    setNotice(
      `상환 완료: Silver -${result.silverDeducted.toLocaleString()} 차감, 담보 도전권 ${result.ticketsReturned}장 반환`
    );
  };

  // 은행 설립
  const handleCreateBank = () => {
    setError('');
    setNotice('');

    if (game.silver < newVaultSilver) {
      setError('보유한 Silver가 부족하여 은행 자본금을 예치할 수 없습니다.');
      return;
    }

    const nextState = { ...bankState };
    const result = createBank(nextState, {
      ownerId: currentUserId,
      ownerName: currentUserName,
      bankName: newBankName,
      vaultSilver: newVaultSilver,
      interestRate: newInterestRate,
      supportedDurations: newDurations,
      isPremium,
      now,
    });

    if (!result.success) {
      setError(result.reason);
      return;
    }

    setGame(prev => ({
      ...prev,
      silver: prev.silver - newVaultSilver,
    }));

    setBankState(nextState);
    setNotice(`은행 설립 완료: '${result.bank.bankName}' 운영을 시작합니다.`);
  };

  return (
    <Screen
      eyebrow="NOVAR BANKING & LOAN GUILD"
      title="은행 · 담보 대출"
      className="tc-bank-screen"
    >
      <div className="tc-bank-container">
        {/* 상단 재화 바 */}
        <div className="tc-bank-wallet-bar">
          <div>
            보유 실버: <b>{game.silver.toLocaleString()}</b>
          </div>
          <div>
            보유 도전권: <b>{availableTickets}장</b>
          </div>
        </div>

        {/* 제재 배너 */}
        {isPenalized && (
          <div className="tc-bank-penalized-banner" role="alert">
            <b>미상환 제재 적용 중</b>: {formatDate(profile.penaltyUntil!)}까지 모든 은행에서
            신규 대출이 제한됩니다.
          </div>
        )}

        {/* 탭 네비게이션 */}
        <Segments
          items={[
            ['loans', '대출 신청'],
            ['my', `내 대출 (${myLoans.filter(l => l.status === 'ACTIVE' || l.status === 'GRACE_PERIOD').length})`],
            ['manage', '은행 운영'],
          ]}
          value={tab}
          onChange={setTab}
          label="은행 메뉴"
        />

        {(notice || error) && (
          <div
            className={error ? 'tc-quest-status error' : 'tc-quest-status'}
            role={error ? 'alert' : 'status'}
          >
            {error || notice}
          </div>
        )}

        {/* 탭 1: 대출 신청 */}
        {tab === 'loans' && (
          <div className="tc-bank-tab-content">
            <div className="tc-bank-card" style={{ background: 'rgba(28, 22, 16, 0.7)' }}>
              <div style={{ fontSize: '11px', color: '#ffdd80' }}>
                ◈ <b>도전권 담보 대출 규칙 안내</b>
              </div>
              <div style={{ fontSize: '11px', color: '#b8ab97', lineHeight: 1.4 }}>
                · 담보: 도전권 1장당 <b>50,000 Silver</b> 대출 인정<br />
                · 만기 일시상환 (중도상환 불가)<br />
                · 만기 후 24시간 유예기간 제공 (6시간마다 4회 독촉)<br />
                · 미상환 시: 담보 도전권 전량 은행 귀속, 채무 전액 소멸, 15일간 대출 금지
              </div>
            </div>

            {bankList.length === 0 ? (
              <div className="tc-loot-empty" style={{ padding: '24px 0' }}>
                현재 운영 중인 은행이 없습니다.
                {isPremium && ' [은행 운영] 탭에서 직접 은행을 설립해 보세요!'}
              </div>
            ) : (
              bankList.map(bank => (
                <div className="tc-bank-card" key={bank.id}>
                  <div className="tc-bank-card-header">
                    <strong>{bank.bankName}</strong>
                    <span className="tc-bank-badge active">이율 {bank.interestRate}%</span>
                  </div>
                  <div className="tc-bank-metrics">
                    <div>
                      <span>은행장:</span>
                      <b>{bank.ownerName}</b>
                    </div>
                    <div>
                      <span>대출 가능 자금:</span>
                      <b>{bank.vaultSilver.toLocaleString()} S</b>
                    </div>
                    <div>
                      <span>지원 기간:</span>
                      <b>{bank.supportedDurations.map(d => d + '일').join(', ')}</b>
                    </div>
                    <div>
                      <span>누적 대출:</span>
                      <b>{bank.stats.totalLoansIssued}건</b>
                    </div>
                  </div>

                  {selectedBankId === bank.id ? (
                    <div className="tc-loan-apply-modal">
                      <h3>대출 조건 설정</h3>
                      <div className="tc-loan-field">
                        <label>담보로 맡길 도전권 수량 (보유: {availableTickets}장)</label>
                        <input
                          type="number"
                          min={1}
                          max={availableTickets}
                          value={ticketInput}
                          onChange={e => setTicketInput(Math.max(1, Number(e.target.value)))}
                        />
                      </div>
                      <div className="tc-loan-field">
                        <label>대출 기간 선택</label>
                        <select
                          value={durationInput}
                          onChange={e => setDurationInput(Number(e.target.value) as LoanDurationDays)}
                        >
                          {bank.supportedDurations.map(d => (
                            <option key={d} value={d}>
                              {d}일 (만기: {formatDate(now + d * 86400000)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="tc-loan-summary-box">
                        <div>
                          <span>대출 원금:</span>
                          <b>{(ticketInput * BANK_CONSTANTS.TICKET_COLLATERAL_VALUE).toLocaleString()} S</b>
                        </div>
                        <div>
                          <span>만기 이자 ({bank.interestRate}%):</span>
                          <b>
                            {Math.floor(
                              ticketInput *
                                BANK_CONSTANTS.TICKET_COLLATERAL_VALUE *
                                (bank.interestRate / 100)
                            ).toLocaleString()} S
                          </b>
                        </div>
                        <div>
                          <span>만기 총 상환액:</span>
                          <b>
                            {(
                              ticketInput * BANK_CONSTANTS.TICKET_COLLATERAL_VALUE +
                              Math.floor(
                                ticketInput *
                                  BANK_CONSTANTS.TICKET_COLLATERAL_VALUE *
                                  (bank.interestRate / 100)
                              )
                            ).toLocaleString()} S
                          </b>
                        </div>
                      </div>

                      <div className="tc-bank-actions">
                        <button type="button" onClick={() => setSelectedBankId(null)}>
                          취소
                        </button>
                        <button
                          type="button"
                          className="tc-action"
                          disabled={
                            isPenalized ||
                            availableTickets < ticketInput ||
                            bank.vaultSilver < ticketInput * BANK_CONSTANTS.TICKET_COLLATERAL_VALUE
                          }
                          onClick={() => handleApplyLoan(bank)}
                        >
                          대출 신청 확정
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="tc-bank-actions">
                      <button
                        type="button"
                        disabled={isPenalized || bank.ownerId === currentUserId}
                        onClick={() => {
                          setSelectedBankId(bank.id);
                          setDurationInput(bank.supportedDurations[0] || 5);
                        }}
                      >
                        {bank.ownerId === currentUserId
                          ? '내 은행 (대출 불가)'
                          : isPenalized
                          ? '제재로 대출 불가'
                          : '대출 신청'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 탭 2: 내 대출 현황 */}
        {tab === 'my' && (
          <div className="tc-bank-tab-content">
            {myLoans.length === 0 ? (
              <div className="tc-loot-empty" style={{ padding: '24px 0' }}>
                진행 중인 대출 내역이 없습니다.
              </div>
            ) : (
              myLoans.map(loan => {
                const isMatured = now >= loan.maturityAt;
                const statusBadge =
                  loan.status === 'REPAID'
                    ? { text: '상환 완료', cls: 'repaid' }
                    : loan.status === 'DEFAULTED'
                    ? { text: '담보 귀속 (채무 소멸)', cls: 'defaulted' }
                    : loan.status === 'GRACE_PERIOD'
                    ? { text: `유예기간 (독촉 ${loan.remindersSent}/4회)`, cls: 'grace' }
                    : { text: '정상 이용 중', cls: 'active' };

                return (
                  <div className="tc-bank-card" key={loan.id}>
                    <div className="tc-bank-card-header">
                      <strong>{loan.bankName}</strong>
                      <span className={`tc-bank-badge ${statusBadge.cls}`}>
                        {statusBadge.text}
                      </span>
                    </div>
                    <div className="tc-bank-metrics">
                      <div>
                        <span>대출 원금:</span>
                        <b>{loan.principalSilver.toLocaleString()} S</b>
                      </div>
                      <div>
                        <span>담보 도전권:</span>
                        <b>{loan.collateralTickets}장</b>
                      </div>
                      <div>
                        <span>만기 상환액:</span>
                        <b>{loan.totalDueSilver.toLocaleString()} S</b>
                      </div>
                      <div>
                        <span>만기 일시:</span>
                        <b>{formatDate(loan.maturityAt)}</b>
                      </div>
                    </div>

                    {(loan.status === 'ACTIVE' || loan.status === 'GRACE_PERIOD') && (
                      <div className="tc-bank-actions">
                        {isMatured ? (
                          <button
                            type="button"
                            className="tc-action"
                            disabled={game.silver < loan.totalDueSilver}
                            onClick={() => handleRepayLoan(loan)}
                          >
                            만기 상환하기 ({loan.totalDueSilver.toLocaleString()} S)
                          </button>
                        ) : (
                          <button type="button" disabled>
                            중도상환 불가 (만기일: {formatDate(loan.maturityAt)})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* 수신된 알림 내역 */}
            {profile.notifications.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: '#ffdd80', marginBottom: '6px' }}>
                  은행 독촉 및 알림 내역
                </div>
                {profile.notifications.slice(-5).reverse().map(n => (
                  <div
                    className={`tc-bank-notif-row ${n.kind === 'DEFAULTED' ? 'defaulted' : ''}`}
                    key={n.id}
                  >
                    <span>{n.message}</span>
                    <small>{formatDate(n.createdAt)}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 탭 3: 은행 운영 */}
        {tab === 'manage' && (
          <div className="tc-bank-tab-content">
            {!isPremium ? (
              <div className="tc-bank-card" style={{ textAlign: 'center', padding: '24px 12px' }}>
                <strong style={{ fontSize: '15px', color: '#ffd700' }}>
                  은행 설립은 프리미엄 계정 전용 혜택입니다
                </strong>
                <p style={{ fontSize: '12px', color: '#a89f91', margin: '10px 0' }}>
                  프리미엄 계정을 활성화하면 직접 은행을 설립하여 이율을 정하고 대출 이자 수익을
                  창출할 수 있습니다.
                </p>
                {onOpenPremium && (
                  <button
                    type="button"
                    className="tc-action"
                    onClick={onOpenPremium}
                    style={{ alignSelf: 'center', minWidth: '160px' }}
                  >
                    프리미엄 계정 보기
                  </button>
                )}
              </div>
            ) : myBank ? (
              <div className="tc-bank-card">
                <div className="tc-bank-card-header">
                  <strong>{myBank.bankName} (운영 중)</strong>
                  <span className="tc-bank-badge active">설립 이율 {myBank.interestRate}%</span>
                </div>
                <div className="tc-bank-metrics">
                  <div>
                    <span>금고 보유 자금:</span>
                    <b>{myBank.vaultSilver.toLocaleString()} S</b>
                  </div>
                  <div>
                    <span>귀속된 담보 도전권:</span>
                    <b>{myBank.collateralTicketsVault}장</b>
                  </div>
                  <div>
                    <span>누적 대출 건수:</span>
                    <b>{myBank.stats.totalLoansIssued}건</b>
                  </div>
                  <div>
                    <span>누적 이자 수익:</span>
                    <b>{myBank.stats.totalInterestEarned.toLocaleString()} S</b>
                  </div>
                  <div>
                    <span>부도 대출 건수:</span>
                    <b>{myBank.stats.totalDefaultedLoans}건</b>
                  </div>
                  <div>
                    <span>지원 기간:</span>
                    <b>{myBank.supportedDurations.map(d => d + '일').join(', ')}</b>
                  </div>
                </div>

                <div className="tc-bank-actions" style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    disabled={game.silver < 500_000}
                    onClick={() => {
                      if (game.silver < 500_000) return;
                      setGame(prev => ({ ...prev, silver: prev.silver - 500_000 }));
                      setBankState(prev => {
                        const b = prev.banks[myBank.id];
                        if (!b) return prev;
                        return {
                          ...prev,
                          banks: {
                            ...prev.banks,
                            [b.id]: { ...b, vaultSilver: b.vaultSilver + 500_000 },
                          },
                        };
                      });
                      setNotice('금고에 500,000 Silver를 추가 예치했습니다.');
                    }}
                  >
                    금고에 500,000 S 추가 예치
                  </button>
                </div>
              </div>
            ) : (
              <div className="tc-loan-apply-modal">
                <h3>새 은행 설립</h3>
                <div className="tc-loan-field">
                  <label>은행 상호명</label>
                  <input
                    type="text"
                    placeholder={`${currentUserName}의 은행`}
                    value={newBankName}
                    onChange={e => setNewBankName(e.target.value)}
                  />
                </div>
                <div className="tc-loan-field">
                  <label>초기 예치 자본금 (최소 1,000,000 S)</label>
                  <input
                    type="number"
                    min={BANK_CONSTANTS.MIN_FOUNDING_VAULT_SILVER}
                    step={100_000}
                    value={newVaultSilver}
                    onChange={e => setNewVaultSilver(Number(e.target.value))}
                  />
                </div>
                <div className="tc-loan-field">
                  <label>대출 이율 (1% ~ 50%)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newInterestRate}
                    onChange={e => setNewInterestRate(Number(e.target.value))}
                  />
                </div>
                <div className="tc-loan-field">
                  <label>지원 대출 기간</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {SUPPORTED_LOAN_DURATIONS.map(d => (
                      <label key={d} style={{ fontSize: '12px' }}>
                        <input
                          type="checkbox"
                          checked={newDurations.includes(d)}
                          onChange={e => {
                            if (e.target.checked) setNewDurations([...newDurations, d]);
                            else if (newDurations.length > 1) {
                              setNewDurations(newDurations.filter(x => x !== d));
                            }
                          }}
                        />
                        {d}일
                      </label>
                    ))}
                  </div>
                </div>

                <div className="tc-bank-actions" style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="tc-action"
                    disabled={game.silver < newVaultSilver}
                    onClick={handleCreateBank}
                  >
                    은행 설립 확정 ({newVaultSilver.toLocaleString()} S 예치)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
