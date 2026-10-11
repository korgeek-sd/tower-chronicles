import type {GameState} from '../types';
/** Separate reward currency, never an inventory item. Old saves have no balance yet. */
export function appearanceSummonTickets(game:GameState):number {
 const balance=game.cosmetics.summonTickets??0;
 if(!Number.isSafeInteger(balance)||balance<0)throw new Error('잘못된 외형 소환권 수량입니다.');
 return balance;
}
/** Apply a confirmed reward. Online callers must obtain the reward from the server. */
export function grantAppearanceSummonTickets(game:GameState,amount:number):GameState {
 if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('소환권 지급 수량은 양의 정수여야 합니다.');
 const balance=appearanceSummonTickets(game)+amount;
 if(!Number.isSafeInteger(balance))throw new Error('소환권 보유 한도를 초과합니다.');
 const next=structuredClone(game);next.cosmetics.summonTickets=balance;
 return next;
}
