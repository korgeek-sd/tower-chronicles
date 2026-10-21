export type NoticeKind='update'|'maintenance';
export type NoticeFilter=NoticeKind|'all';
export interface StartNotice{id:string;kind:NoticeKind;publishedAt:string;title:string;body:readonly string[]}
// Public release notes only. Do not put account information or credentials here.
export const START_NOTICES:readonly StartNotice[]=[
 {id:'entry-progress-20261021',kind:'update',publishedAt:'2026-10-21T00:00:00+09:00',title:'접속 상태 안내 및 재시도 기능 추가',body:[
  '게임 입장 시 계정 확인, 접속 권한 확인, 기록 불러오기 단계를 표시합니다.',
  '접속에 실패하면 안내를 확인하고 다시 시도할 수 있습니다. 입장 버튼의 중복 클릭도 방지합니다.',
  '저장된 기록의 복원이 완료된 뒤 게임 화면으로 연결합니다.'
 ]},
 {id:'title-screen-20261021',kind:'update',publishedAt:'2026-10-21T00:00:00+09:00',title:'시작화면 배경과 서버 선택 적용',body:[
  '새로운 도트 배경과 확정 로고를 시작화면에 적용했습니다. 배경이 검게 표시되던 이미지 경로 오류를 수정했습니다.',
  '시작화면에 서버 선택을 추가했습니다. 현재 선택 가능한 서버는 1서버입니다.',
  'Google 계정 로그인 상태를 유지하며, 새로 실행하면 시작화면에서 입장할 수 있습니다.'
 ]}
];
export function getPublishedNotices(notices:readonly StartNotice[]=START_NOTICES,filter:NoticeFilter='all',now=Date.now()){
 return notices.filter(n=>Number.isFinite(Date.parse(n.publishedAt))&&Date.parse(n.publishedAt)<=now&&(filter==='all'||n.kind===filter)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
export const noticeDate=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
