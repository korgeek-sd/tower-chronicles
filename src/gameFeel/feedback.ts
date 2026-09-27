import type{GameFeelRecipe}from'./types';
export type FeedbackEntry={id:number;recipe:GameFeelRecipe;createdAt:number;expiresAt:number};
export type FeedbackQueue={enqueue:(recipe:GameFeelRecipe)=>FeedbackEntry;snapshot:()=>readonly FeedbackEntry[];prune:(now?:number)=>void;clear:()=>void};
export function createFeedbackQueue(options?:{maxActive?:number;now?:()=>number}):FeedbackQueue{
 const max=Math.max(1,options?.maxActive??12),clock=options?.now??Date.now;let seq=0,items:FeedbackEntry[]=[];
 return{enqueue(recipe){const now=clock(),entry={id:++seq,recipe,createdAt:now,expiresAt:now+recipe.duration};items=[...items,entry].slice(-max);return entry;},snapshot(){return items;},prune(now=clock()){items=items.filter(item=>item.expiresAt>now);},clear(){items=[];}};
}
