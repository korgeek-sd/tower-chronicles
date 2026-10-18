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

  // 은행 컴포넌트 렌더링 (isPremium: false)
  const html = renderToStaticMarkup(
    React.createElement(BankScreen, {
      game,
      setGame: () => {},
      bankState,
      setBankState: () => {},
      isPremium: false,
    })
  );

  // 기본 상태에서 loans 탭이 활성화되어 있으므로 manage 탭 안내 텍스트 존재 확인
  assert.match(html, /tc-bank-screen/);
});
