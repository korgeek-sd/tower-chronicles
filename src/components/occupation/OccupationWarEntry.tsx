import React,{useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {VillageWarBattleScreen} from './VillageWarBattleScreen';
import {OccupationScreen} from './OccupationScreen';

export function OccupationWarEntry({userId=null,game,nickname,onlineLease}:{userId?:string|null;game:GameState;nickname?:string;onlineLease:GameplayLease|null}){
 const [legacy,setLegacy]=useState(false);
 return legacy
  ?<section className="tc-war-legacy-shell" style={{height:'100%',minHeight:0,display:'grid',gridTemplateRows:'40px minmax(0,1fr)'}}>
    <button type="button" className="tc-action secondary" onClick={()=>setLegacy(false)}>‹ 5전선 영지 점령전으로 돌아가기</button>
    <OccupationScreen onlineLease={onlineLease}/>
   </section>
  :<VillageWarBattleScreen userId={userId} game={game} nickname={nickname} lease={onlineLease} onLegacy={()=>setLegacy(true)}/>;
}
