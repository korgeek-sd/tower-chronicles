import React from 'react';
import type {FeedbackEntry} from '../feedback';
import type {GameFeelCommand} from '../types';

const commandClass=(command:GameFeelCommand)=>'tc-gf-'+command.type;
const tone=(command:GameFeelCommand)=>'tone' in command?command.tone:'neutral';

export function FeedbackLayer({entries}:{entries:readonly FeedbackEntry[]}){
 return <div className="tc-gf-layer" aria-hidden="true">
  {entries.map(entry=><div
   className={'tc-gf-entry tc-gf-intensity-'+entry.recipe.intensity}
   data-event={entry.recipe.event}
   key={entry.id}
   style={{'--tc-gf-duration':entry.recipe.duration+'ms'} as React.CSSProperties}
  >
   {entry.recipe.commands.map((command,index)=>{
    if(command.type==='haptic')return null;
    if(command.type==='particles')return <span
     className={commandClass(command)}
     data-tone={tone(command)}
     key={index}
     style={{'--tc-gf-command-duration':command.duration+'ms'} as React.CSSProperties}
    >{Array.from({length:Math.min(10,Math.max(1,command.count))},(_,particle)=><i key={particle} style={{'--tc-gf-particle':particle} as React.CSSProperties}/>)}</span>;
    return <span
     className={commandClass(command)}
     data-tone={tone(command)}
     data-target={'target' in command?command.target:undefined}
     key={index}
     style={{'--tc-gf-command-duration':('duration' in command?command.duration:entry.recipe.duration)+'ms'} as React.CSSProperties}
    />;
   })}
  </div>)}
 </div>;
}
