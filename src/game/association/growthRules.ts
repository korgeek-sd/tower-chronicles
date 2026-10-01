import {ASSOCIATION_LEVEL_TABLE} from './progression';

export function associationDonationGain(currency:'silver'|'gold',amount:number){
 const unit=currency==='silver'?10000:100;
 if(!Number.isSafeInteger(amount)||amount<=0||amount%unit!==0)throw Error('기부 단위를 확인해 주세요.');
 return amount/unit*(currency==='silver'?100:200);
}

export function associationPeriodStart(period:'DAILY'|'WEEKLY',at:number){
 const date=new Date(at+9*60*60*1000);
 if(period==='WEEKLY')date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
 return date.toISOString().slice(0,10);
}

export function associationLevelProgress(exp:number){
 let level=1;
 for(let i=0;i<ASSOCIATION_LEVEL_TABLE.length;i++)if(exp>=ASSOCIATION_LEVEL_TABLE[i])level=i+1;
 const startExp=ASSOCIATION_LEVEL_TABLE[level-1];
 const nextExp=ASSOCIATION_LEVEL_TABLE[Math.min(level,9)];
 const percent=level===10?100:Math.max(0,Math.min(100,(exp-startExp)/(nextExp-startExp)*100));
 return {level,startExp,nextExp,percent};
}
