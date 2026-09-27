import React,{createContext,useCallback,useMemo,useRef,useState}from'react';
import{resolveGameFeelRecipe}from'../engine';import{createFeedbackQueue,type FeedbackEntry}from'../feedback';import{playHaptic}from'../haptics';import{readGameFeelPreferences}from'../preferences';import type{GameFeelEvent,GameFeelPayloadMap}from'../types';
export type GameFeelApi={play:<E extends GameFeelEvent>(event:E,payload?:GameFeelPayloadMap[E])=>void};
export const GameFeelContext=createContext<GameFeelApi>({play:()=>{}});
export function GameFeelProvider({children}:{children:React.ReactNode}){
 const queue=useRef(createFeedbackQueue());const[entries,setEntries]=useState<readonly FeedbackEntry[]>([]);
 const play=useCallback(<E extends GameFeelEvent>(event:E,payload?:GameFeelPayloadMap[E])=>{try{const recipe=resolveGameFeelRecipe(event,payload,{reducedMotion:readGameFeelPreferences()});const entry=queue.current.enqueue(recipe);for(const c of recipe.commands)if(c.kind==='haptic')playHaptic(c.intensity);setEntries(queue.current.snapshot());window.setTimeout(()=>{queue.current.prune();setEntries(queue.current.snapshot())},entry.recipe.duration+20);}catch{}},[]);
 const api=useMemo(()=>({play}),[play]);return <GameFeelContext.Provider value={api}><div className="tc-feel-root">{children}<FeedbackLayer entries={entries}/></div></GameFeelContext.Provider>;
}
import{FeedbackLayer}from'./FeedbackLayer';
