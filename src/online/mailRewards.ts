import type {GameState} from '../game/types';
import type {MailState} from './mail';
import {applyOnlineEconomyToGame} from './market';
/** Apply server balances, never add the attachment again on the client. */
export function applyMailRewards(game:GameState,response:MailState):GameState {
 const tickets=response.summonTickets;
 if(tickets!=null&&(!Number.isSafeInteger(tickets)||tickets<0))throw Error('잘못된 외형 소환권 잔액입니다. 우편함을 새로고침해 주세요.');
 let next=response.economy?applyOnlineEconomyToGame(game,response.economy):game;
 if(tickets!=null){if(next===game)next=structuredClone(game);next.cosmetics.summonTickets=tickets;}
 return next;
}
