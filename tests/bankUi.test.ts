import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BankScreen } from '../src/components/bank/BankScreen';
import { initialState } from '../src/game/engine/state';
import { initialBankSystemState } from '../src/game/bank/service';

test('BANK UI 01: 은행 화면 기본 렌더링 및 3개 탭 구성 확인', () => {
  const game = initialState();
  const bankState = initialBankSystemState();

  const html = renderToStaticMarkup(
    React.createElement(BankScreen, {
      game,
      setGame: () => {},
      bankState,
      setBankState: () => {},
      isPremium: false,
    })
  );

  // 헤더 및 타이틀 확인
  assert.match(html, /은행 · 담보 대출/);
  assert.match(html, /NOVAR BANKING &amp; LOAN GUILD/);

  // 3개 탭 확인
  assert.match(html, />대출 신청<\/button>/);
  assert.match(html, />내 대출 \(0\)<\/button>/);
  assert.match(html, />은행 운영<\/button>/);

  // 보유 재화 바 확인
  assert.match(html, /보유 실버/);
  assert.match(html, /보유 도전권/);

  // 대출 규칙 안내 카드 확인
  assert.match(html, /도전권 담보 대출 규칙 안내/);
  assert.match(html, /50,000 Silver/);
  assert.match(html, /만기 일시상환 \(중도상환 불가\)/);
  assert.match(html, /24시간 유예기간/);
});

test('BANK UI 02: 제재 적용 중인 유저는 상단 제재 경고 배너가 표시된다', () => {
  const game = initialState();
  const bankState = initialBankSystemState();
  const now = 1000000;

  // 제재 프로필 주입
  bankState.profiles['penalized_user'] = {
    userId: 'penalized_user',
    penaltyUntil: now + 10 * 24 * 60 * 60 * 1000,
    activeLoanIds: [],
    ownedBankId: null,
    notifications: [],
  };

  const html = renderToStaticMarkup(
    React.createElement(BankScreen, {
      game,
      setGame: () => {},
      bankState,
      setBankState: () => {},
      userId: 'penalized_user',
      isPremium: false,
      now,
    })
  );

  assert.match(html, /tc-bank-penalized-banner/);
  assert.match(html, /미상환 제재 적용 중/);
  assert.match(html, /신규 대출이 제한됩니다/);
});

test('BANK UI 03: 비 프리미엄 유저는 은행 운영 탭에서 프리미엄 전용 안내가 뜬다', () => {
  const game = initialState();
  const bankState = initialBankSystemState();

  const html = renderToStaticMarkup(
    React.createElement(BankScreen, {
      game,
      setGame: () => {},
      bankState,
      setBankState: () => {},
      isPremium: false,
      initialTab: 'manage',
      onOpenPremium: () => {},
    })
  );

  assert.match(html, /은행 설립은 프리미엄 계정 전용 혜택입니다/);
  assert.match(html, /프리미엄 계정을 활성화하면 직접 은행을 설립하여/);
  assert.match(html, /프리미엄 계정 보기/);
});

test('BANK UI 04: 프리미엄 유저는 은행 운영 탭에서 새 은행 설립 폼이 뜬다', () => {
  const game = initialState();
  game.silver = 2_000_000;
  const bankState = initialBankSystemState();

  const html = renderToStaticMarkup(
    React.createElement(BankScreen, {
      game,
      setGame: () => {},
      bankState,
      setBankState: () => {},
      userId: 'rich_premium_user',
      userName: '부자모험가',
      isPremium: true,
      initialTab: 'manage',
    })
  );

  assert.match(html, /새 은행 설립/);
  assert.match(html, /은행 상호명/);
  assert.match(html, /초기 예치 자본금 \(최소 1,000,000 S\)/);
  assert.match(html, /대출 이율 \(1% ~ 50%\)/);
  assert.match(html, /지원 대출 기간/);
  assert.match(html, /은행 설립 확정/);
});

test('BANK UI 05: 은행을 설립한 프리미엄 유저는 은행 운영 대시보드가 뜬다', () => {
  const game = initialState();
  const bankState = initialBankSystemState();

  // 기존 운영 중인 은행 등록
  bankState.banks['bank_test'] = {
    id: 'bank_test',
    ownerId: 'owner_user',
    ownerName: '은행장',
    bankName: '노바르 중앙은행',
    vaultSilver: 5_000_000,
    collateralTicketsVault: 12,
    interestRate: 15,
    supportedDurations: [5, 10, 15, 30],
    active: true,
    createdAt: 1000,
    stats: {
      totalLoansIssued: 8,
      totalPrincipalLent: 4_000_000,
      totalInterestEarned: 600_000,
      totalDefaultedLoans: 1,
      totalDefaultedTickets: 2,
    },
  };
  bankState.profiles['owner_user'] = {
    userId: 'owner_user',
    penaltyUntil: null,
    activeLoanIds: [],
    ownedBankId: 'bank_test',
    notifications: [],
  };

  const html = renderToStaticMarkup(
    React.createElement(BankScreen, {
      game,
      setGame: () => {},
      bankState,
      setBankState: () => {},
      userId: 'owner_user',
      userName: '은행장',
      isPremium: true,
      initialTab: 'manage',
    })
  );

  assert.match(html, /노바르 중앙은행 \(운영 중\)/);
  assert.match(html, /설립 이율 15%/);
  assert.match(html, /5,000,000 S/);
  assert.match(html, /귀속된 담보 도전권:<\/span><b>12장<\/b>/);
  assert.match(html, /누적 대출 건수:<\/span><b>8건<\/b>/);
  assert.match(html, /누적 이자 수익:<\/span><b>600,000 S<\/b>/);
  assert.match(html, /부도 대출 건수:<\/span><b>1건<\/b>/);
  assert.match(html, /금고에 500,000 S 추가 예치/);
});

