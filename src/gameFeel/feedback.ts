import type {GameFeelRecipe} from './types';

export interface FeedbackEntry{
 id:string;
 recipe:GameFeelRecipe;
 createdAt:number;
 expiresAt:number;
}

export interface FeedbackQueue{
 enqueue(recipe:GameFeelRecipe,now?:number):FeedbackEntry;
 snapshot():readonly FeedbackEntry[];
 prune(now?:number):void;
 clear():void;
}

let nextFeedbackId=0;

export function createFeedbackQueue(options?:{maxActive?:number}):FeedbackQueue{
 const maxActive=Math.max(1,Math.floor(options?.maxActive??12));
 let entries:FeedbackEntry[]=[];
 return {
  enqueue(recipe,now=Date.now()){
   const entry={
    id:'gf-'+(++nextFeedbackId),
    recipe,
    createdAt:now,
    expiresAt:now+Math.max(1,recipe.duration),
   };
   entries=[...entries,entry];
   if(entries.length>maxActive)entries=entries.slice(entries.length-maxActive);
   return entry;
  },
  snapshot(){
   return entries.slice();
  },
  prune(now=Date.now()){
   entries=entries.filter(entry=>entry.expiresAt>now);
  },
  clear(){
   entries=[];
  },
 };
}
