import test from 'node:test';
import assert from 'node:assert/strict';
import {associationNameError,associationNameKey} from '../src/game/association/nameRules.ts';
import {initialState} from '../src/game/engine/state.ts';
import {createAssociation} from '../src/game/association/service.ts';

test('원정단 이름: 허용 한글/영문/숫자, 최대 6자',()=>{
 for(const value of ['검은새벽','흑기사단','제7원정대','Black7','가나','AB','A1'])assert.equal(associationNameError(value),null,value);
});
test('원정단 이름: 공백/자모/문장부호/이모지/숫자전용/반복문자/과길이 차단',()=>{
 for(const value of ['검은 새벽','검은　새벽',' 검은새벽','검은새벽 ','ㄴㄹㅎㅊ','ㄹㅎㄷㅌ','ㅏㅓㅗㅜ','검은ㄱ단','기사ㅏ단','ㄱㅏㄴㅏ','검은_새벽','검은!','검은😀','123456','ㅋㅋㅋㅋ','AAAA','aaaa','검은새벽기사단','가'])
  assert.ok(associationNameError(value),value);
});
test('원정단 이름: 한글/영문 금지어, 사칭, 로마자 우회 차단',()=>{
 for(const value of ['씨발단','시발','병신','ㅅㅂ','존나','섹스단','야동','보지','자지','한남','짱깨','GM기사','ADMIN','GM','SIBAL','SHIBAL','SSIBAL','F0CK','fuck','FUK','B1TCH','porn','Nazi','관리자','개발자','탑기록원','노바르평의회'])
  assert.ok(associationNameError(value),value);
});
test('원정단 이름: 오탐 피하기 위한 완전 일치와 세계관 허용',()=>{
 for(const value of ['사신','암살자','광전사','악마','마왕','학살자','지옥','파멸','Devil','CLASS','XSEXY'])
  assert.equal(associationNameError(value),null,value);
 assert.ok(associationNameError('DEV'));
 assert.ok(associationNameError('SEX'));
});
test('원정단 이름: 기존 원정단과 공백/대소문자 차이도 중복 검사',()=>{
 assert.equal(associationNameKey('검은 새벽'),associationNameKey('검은새벽'));
 assert.equal(associationNameKey('BLACK'),associationNameKey('black'));
 const s=initialState();
 s.silver=1000;
 s.association.associations.push({associationId:'existing',status:'ACTIVE',name:'검은 새벽'} as any);
 const result=createAssociation(s,{name:'검은새벽',description:'',joinPolicy:'OPEN'});
 assert.equal(result.association.currentId,null);
 assert.equal(result.silver,s.silver);
});
