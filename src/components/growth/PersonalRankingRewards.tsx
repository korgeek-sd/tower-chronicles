import React from 'react';
import {assetUrl} from '../../game/data/graphics';
import {GuildTask} from '../association/GuildTask';

const rewardTiers = [
 { lastRank: 1, label: '1위', amount: 100 },
 { lastRank: 2, label: '2위', amount: 80 },
 { lastRank: 3, label: '3위', amount: 60 },
 { lastRank: 10, label: '4~10위', amount: 40 },
 { lastRank: 20, label: '11~20위', amount: 25 },
 { lastRank: 30, label: '21~30위', amount: 10 },
];
function tierForRank(rank: number | null) {
 return rank && rank > 0 ? rewardTiers.find(tier => rank <= tier.lastRank) : undefined;
}
const rewardImages = {
 ticket: ['appearance_summon_ticket_pixel.webp','외형 소환권'],
 box: ['adventurer_equipment_box.png','모험가 장비 상자'],
 selector: ['ssr_shard_selector.webp','SSR 외형 조각 선택권'],
};
function RewardIcon({kind}:{kind:keyof typeof rewardImages}) {
 const [file,label] = rewardImages[kind];
 return <img className="tc-rank-item" alt={label} src={assetUrl('assets/ui/shop/'+file)}/>;
}

export function PersonalRankingRewards({ownRank}:{ownRank:number|null}) {
 const tier = tierForRank(ownRank);
 const month = Number(new Intl.DateTimeFormat('en-US',{month:'numeric',timeZone:'Asia/Seoul'}).format(new Date()));
 return <div className="tc-gr-monthly">
  <GuildTask title="월간 보상" dialogClassName="tc-gr-rewards-dialog" trigger={<>
   <span>월간 보상 ›</span>
   {tier && <small aria-label="현재 순위 예상 보상"><RewardIcon kind="ticket"/>×{tier.amount} <RewardIcon kind="box"/>×{tier.amount}{ownRank===1 && <> <RewardIcon kind="selector"/>×1</>}</small>}
  </>}>
   <div className="tc-gr-reward-period"><strong>{month}월 개인 전투력 랭킹</strong><span>다음 정산 {month%12+1}월 1일</span></div>
   <table className="tc-gr-reward-table" aria-label="개인 랭킹 월간 보상표">
    <thead><tr><th scope="col">순위</th><th scope="col">외형 소환권</th><th scope="col">장비 상자</th></tr></thead>
    <tbody>{rewardTiers.map(row=><tr key={row.lastRank} data-mine={tier===row}>
     <th scope="row">{row.label}{tier===row && <small>내 구간</small>}</th>
     <td><RewardIcon kind="ticket"/>{row.amount}장</td>
     <td><RewardIcon kind="box"/>{row.amount}개</td>
    </tr>)}</tbody>
   </table>
   <div className="tc-gr-reward-bonus"><RewardIcon kind="selector"/><div><small>1위 추가 보상</small><strong>SSR 외형 조각 선택권 1장</strong></div></div>
  </GuildTask>
 </div>;
}
