import type{FeedbackEntry}from'../feedback';
export function FeedbackLayer({entries}:{entries:readonly FeedbackEntry[]}){
 return <div className="tc-feel-layer" aria-hidden="true">{entries.map(entry=><div className={'tc-feel-event tc-feel-'+entry.recipe.intensity} key={entry.id}>{entry.recipe.commands.map((c,i)=>c.kind==='haptic'||c.kind==='press'?null:<i key={i} className={'tc-feel-'+c.kind+' '+('tone'in c&&c.tone?'tone-'+c.tone:'')}/>)}</div>)}</div>;
}
