import React,{createContext,useCallback,useEffect,useRef,useState} from 'react';
import {resolveGameFeelRecipe} from '../engine';
import {createFeedbackQueue,type FeedbackEntry} from '../feedback';
import {playHaptic} from '../haptics';
import {readGameFeelPreferences} from '../preferences';
import type {GameFeelEvent,GameFeelPayloadMap} from '../types';
import {FeedbackLayer} from './FeedbackLayer';

export interface GameFeelApi{
 play<E extends GameFeelEvent>(event:E,payload?:GameFeelPayloadMap[E]):void;
}

export const GameFeelContext=createContext<GameFeelApi|null>(null);

export function GameFeelProvider({children}:{children:React.ReactNode}){
 const queueRef=useRef(createFeedbackQueue({maxActive:12}));
 const [entries,setEntries]=useState<readonly FeedbackEntry[]>([]);
 const [reducedMotion,setReducedMotion]=useState(()=>readGameFeelPreferences().reducedMotion);

 useEffect(()=>{
  if(typeof globalThis.matchMedia!=='function')return;
  const media=globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReducedMotion(media.matches);
  media.addEventListener?.('change',update);
  return()=>media.removeEventListener?.('change',update);
 },[]);

 const play=useCallback(<E extends GameFeelEvent>(event:E,payload?:GameFeelPayloadMap[E])=>{
  try{
   const recipe=resolveGameFeelRecipe(event,payload,{reducedMotion});
   for(const command of recipe.commands){
    if(command.type==='haptic')playHaptic(command.intensity);
   }
   const queue=queueRef.current;
   queue.prune();
   queue.enqueue(recipe);
   setEntries(queue.snapshot());
   globalThis.setTimeout(()=>{
    try{
     queue.prune();
     setEntries(queue.snapshot());
    }catch{
     // Feedback cleanup is isolated from gameplay.
    }
   },recipe.duration+24);
  }catch{
   // Game Feel is presentation-only and must never block gameplay.
  }
 },[reducedMotion]);

 const api=React.useMemo<GameFeelApi>(()=>({play}),[play]);
 return <GameFeelContext.Provider value={api}>
  {children}
  <FeedbackLayer entries={entries}/>
 </GameFeelContext.Provider>;
}
