import React from 'react';
import {Screen} from '../../ui/mobile';
import './bank.css';

/** No wallet, bank storage or transaction handlers are mounted during maintenance. */
export function BankScreen(){
 return <Screen eyebrow="NOVAR BANKING & LOAN GUILD" title="은행 · 담보 대출">
  <div className="tc-bank-card" role="status">
   <h2>은행 기능 점검 중</h2>
   <p>거래 안정성 개선을 위해 은행 설립, 대출, 상환, 추가 예치 및 자동 상환을 일시 중단했습니다.</p>
   <p>기존 기록은 이 브라우저에 보존됩니다. 점검 기간에는 자동 정산과 연체 처리를 진행하지 않습니다.</p>
   <p>서비스 재개 및 기존 기록 처리 기준은 추후 안내하겠습니다.</p>
  </div>
 </Screen>;
}
