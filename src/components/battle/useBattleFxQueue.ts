import {useCallback,useEffect,useRef,useState} from 'react';
import type {BattleFxEvent} from '../../game/engine/battleFx';
import {buildBattleFxBatch,type BattleFxBatch,type BattleFxPlaybackEvent,type BattleFxSourceAction} from './battleFxPresentation';

export function useBattleFxQueue(){
  const [queue,setQueue]=useState<BattleFxBatch[]>([]);
  const [activeEvents,setActiveEvents]=useState<BattleFxPlaybackEvent[]>([]);
  const nextBatchId=useRef(0);
  const seenBatchIds=useRef(new Set<string>());
  const seenPlaybackIds=useRef(new Set<string>());
  const expiryTimers=useRef(new Set<number>());

  const enqueueBatch=useCallback((batch:BattleFxBatch)=>{
    if(!batch.events.length||seenBatchIds.current.has(batch.id))return false;
    seenBatchIds.current.add(batch.id);
    const unique=batch.events.filter(event=>{
      if(seenPlaybackIds.current.has(event.playbackId))return false;
      seenPlaybackIds.current.add(event.playbackId);
      return true;
    });
    if(!unique.length)return false;
    setQueue(current=>[...current,{...batch,events:unique}]);
    return true;
  },[]);

  const enqueue=useCallback((events:BattleFxEvent[],sourceAction:BattleFxSourceAction)=>{
    if(!events.length)return false;
    const id='battle-fx-'+(++nextBatchId.current);
    return enqueueBatch(buildBattleFxBatch(events,id,sourceAction));
  },[enqueueBatch]);

  const clear=useCallback(()=>{
    for(const timer of expiryTimers.current)window.clearTimeout(timer);
    expiryTimers.current.clear();
    setQueue([]);
    setActiveEvents([]);
    seenBatchIds.current.clear();
    seenPlaybackIds.current.clear();
  },[]);

  const current=queue[0]??null;
  useEffect(()=>{
    if(!current)return;
    const activationTimers:number[]=[];
    for(const event of current.events){
      const activation=window.setTimeout(()=>{
        setActiveEvents(active=>active.some(item=>item.playbackId===event.playbackId)?active:[...active,event]);
        const expiry=window.setTimeout(()=>{
          expiryTimers.current.delete(expiry);
          setActiveEvents(active=>active.filter(item=>item.playbackId!==event.playbackId));
        },event.lifetimeMs);
        expiryTimers.current.add(expiry);
      },event.atMs);
      activationTimers.push(activation);
    }
    const finish=window.setTimeout(()=>{
      setQueue(active=>active[0]?.id===current.id?active.slice(1):active);
    },current.durationMs);
    activationTimers.push(finish);
    return()=>activationTimers.forEach(timer=>window.clearTimeout(timer));
  },[current?.id]);

  useEffect(()=>()=>{for(const timer of expiryTimers.current)window.clearTimeout(timer);expiryTimers.current.clear();},[]);

  return {activeEvents,busy:queue.length>0,enqueue,enqueueBatch,clear};
}
