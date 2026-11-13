import {useEffect,useState} from 'react';
import type {GameplayLease} from './gameSession';
import {getStoredSession} from './auth';
import {getQuests} from './quests';
import {getFreeAttendanceStatus} from './freeAttendance';
import {hasClaimableQuestRewards,hasUnclaimedAttendance} from '../game/actionAlerts';

export interface ActionAlertFlags{quests:boolean;attendance:boolean}
const NONE:ActionAlertFlags={quests:false,attendance:false};

/** Polls only real server-claimable rewards for the current authorized account.
 * Failure/guest/lease change never manufactures a pending-action badge.
 * Claim flows broadcast tc-action-alert-refresh after their server result.
 */
export function useActionAlerts(userId:string|null,lease:GameplayLease|null):ActionAlertFlags{
 const [flags,setFlags]=useState<ActionAlertFlags>(NONE);
 useEffect(()=>{
  let alive=true,busy=false,queued=false;
  setFlags(NONE);
  if(!userId||!lease)return;
  const refresh=async()=>{
   if(!alive||document.hidden)return;
   if(busy){queued=true;return;}
   busy=true;
   try{
    const [quests,attendance]=await Promise.allSettled([
     getQuests(lease,userId),getFreeAttendanceStatus(lease,userId)
    ]);
    if(!alive||getStoredSession()?.userId!==userId)return;
    setFlags({
     quests:quests.status==='fulfilled'&&hasClaimableQuestRewards(quests.value),
     attendance:attendance.status==='fulfilled'&&hasUnclaimedAttendance(attendance.value),
    });
   }finally{
    busy=false;
    if(queued&&alive){queued=false;void refresh();}
   }
  };
  const onFocus=()=>{if(!document.hidden)void refresh();};
  void refresh();
  const interval=window.setInterval(onFocus,60_000);
  window.addEventListener('focus',onFocus);
  window.addEventListener('tc-action-alert-refresh',onFocus);
  document.addEventListener('visibilitychange',onFocus);
  return()=>{
   alive=false;
   window.clearInterval(interval);
   window.removeEventListener('focus',onFocus);
   window.removeEventListener('tc-action-alert-refresh',onFocus);
   document.removeEventListener('visibilitychange',onFocus);
  };
 },[userId,lease?.leaseId,lease?.generation]);
 return flags;
}
