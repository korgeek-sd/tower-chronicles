import type {GameState} from '../types';
import {SKILLS} from '../data/config';
import {bookName} from './loot';
export function useSkillBook(state: GameState, id: string): GameState {
  if(state.expedition) return {...state, notice:'스킬북은 안전 귀환 후 사용할 수 있습니다.'};
  if(!SKILLS.some(s=>s.id===id)) return {...state, notice:'사용할 수 없는 스킬북입니다.'};
  if(!(state.skillBooks[id]>0)) return {...state, notice:'보유한 스킬북이 없습니다.'};
  if(state.learned.includes(id)) return {...state, notice:'이미 배운 스킬입니다. 스킬북은 보관합니다.'};
  const next=structuredClone(state);
  next.skillBooks[id]--;
  next.learned.push(id);
  next.notice=bookName(id)+' 1개 사용 · 스킬을 배웠습니다. 스킬 설정에서 장착하세요.';
  return next;
}

