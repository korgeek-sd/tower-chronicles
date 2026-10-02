import type {OnlineMarketGear,OnlineMarketState} from './market';
import type {GameplayLease} from './gameSession';
import {getDeviceId} from './cloudSave';
import {getFreshSession} from './auth';
import {supabaseConfig} from './config';
import type {CouponReward} from './coupons';
export interface MailDetails {itemId?:string;itemName?:string;gear?:OnlineMarketGear|null;original:number;filled:number;remaining:number;total:number;fee:number;refund:number}
export interface MailContent {title:string;category:'trade'|'reward'|'notice';body:string;details:MailDetails;attachment:{itemId:string;quantity:number;gear:OnlineMarketGear|null;reward?:CouponReward}|null}
export interface GameMail extends MailContent {mailId:string;read:boolean;claimed:boolean;createdAt:number;expiresAt:number}
export interface MailState {mails:GameMail[];economy?:OnlineMarketState|null}
export function mailBody(mail:MailContent):string{
 if(mail.attachment?.reward){const r=mail.attachment.reward;return [mail.body,'',...(r.silver?[`${r.silver.toLocaleString()} 실버`]:[]),...(r.gold?[`${r.gold.toLocaleString()} 골드`]:[]),...(r.items??[]).map(i=>`${i.id==='other:job_draw_ticket'?'직능 등록권':i.id==='other:enhancement_stone'?'강화석':i.id} × ${i.quantity.toLocaleString()}`)].join('\n');}
 if(mail.category!=='trade')return mail.body;
 const d=mail.details,buy=mail.title.startsWith('구매'),complete=mail.title.endsWith('완료'),expired=mail.title.endsWith('만료');
 const noun=buy?'구매':'판매',money=(n:number)=>(n??0).toLocaleString()+' 실버';
 const intro=complete?`${noun} 주문이 모두 체결되었습니다.`:expired?`등록 후 30일이 지나 ${noun} 주문이 만료되었습니다. ${buy?'미체결':'미판매'} 수량의 ${noun}가 자동으로 취소되었습니다.`:`${noun} 주문이 취소되었습니다. 이미 ${buy?'구매된 아이템은 유지되며':'완료된 판매는 유지되며'}, ${buy?'미체결':'미판매'} 수량만 취소됩니다.`;
 const rows=[intro,'',`아이템: ${d.itemName??d.itemId??'아이템'}`];
 if(complete){rows.push(`${noun} 수량: ${d.filled}개`,`총 ${noun} 금액: ${money(d.total)}`);if(!buy)rows.push(`거래 수수료: ${money(d.fee)}`,`정산 금액: ${money(d.total-d.fee)}`);rows.push('',buy?'구매한 아이템은 인벤토리에 지급되었습니다.':'판매 대금은 보유 실버에 반영되었습니다.');}
 else{rows.push(`주문 수량: ${d.original}개`,`${buy?'구매':'판매'}된 수량: ${d.filled}개`,`${buy?'취소':'반환'} 수량: ${d.remaining}개`);if(buy)rows.push(`반환 금액: ${money(d.refund)}`,'','취소 수량에 해당하는 구매 예약금은 보유 실버에 반환되었습니다.');else rows.push('','판매되지 않은 아이템이 첨부되어 있습니다. 받기 버튼을 눌러 수령해 주세요.');}
 return rows.join('\n');
}
async function rpc(name:string,args:Record<string,unknown>={},expectedUser?:string):Promise<MailState>{
 if(!supabaseConfig)throw Error('온라인 설정이 필요합니다.');
 const session=await getFreshSession();if(!session)throw Error('Google 로그인이 필요합니다.');
 if(expectedUser&&session.userId!==expectedUser)throw Error('계정이 변경되었습니다. 우편함을 다시 열어 주세요.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify(args)});
 const raw=await response.text();
 if(!response.ok){const messages:Record<string,string>={MAIL_UNCLAIMED:'첨부 아이템을 먼저 수령해 주세요.',MAIL_NOT_FOUND:'삭제되었거나 보관 기간이 지난 우편입니다.',MAIL_EXPEDITION_BLOCKED:'첨부 아이템은 거점에서 수령할 수 있습니다.',GAME_SESSION_LOST:'다른 기기에서 플레이가 시작되었습니다.'};for(const [key,message]of Object.entries(messages))if(raw.includes(key))throw Error(message);throw Error('우편 요청에 실패했습니다. 다시 시도해 주세요.');}
 return JSON.parse(raw) as MailState;
}
export const loadGameMail=(userId:string)=>rpc('get_game_mail',{},userId);
export const manageGameMail=(userId:string,lease:GameplayLease,action:'read'|'claim'|'claim_all'|'delete'|'delete_read',mailId?:string)=>rpc('manage_game_mail',{p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),p_action:action,p_mail_id:mailId??null},userId);

