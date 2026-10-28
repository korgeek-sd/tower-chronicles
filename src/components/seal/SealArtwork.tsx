import React from 'react';
import type {AssociationSealId} from '../../online/seal';

const sealUrl=new URL('../../assets/ui/seals/seal-solar-reference-v1.png',import.meta.url).href;
const stages=Array.from({length:30},(_,index)=>index+1);

/** Raster artwork and server-derived progress only. No gameplay or idle timers. */
export function SealArtwork({variant,level,mode,sequence}:{
 variant:AssociationSealId;level:number;mode:'idle'|'forge'|'reset';sequence:number;
}){
 return <div className="tc-insignia-orbit" data-variant={variant}>
  <img key={sequence} className="tc-insignia-reference-art" src={sealUrl}
   data-motion={mode} alt={variant==='guardian'?'수호 인장':'전투 인장'} draggable={false}/>
  <ol className="tc-insignia-ring" aria-label="30단계 주조 진행">
   {stages.map(stage=>{
    const angle=(140+(stage-1)*260/29)*Math.PI/180;
    return <li className="tc-insignia-ring-node" key={stage}
     data-reached={stage<=level} data-current={stage===level}
     aria-current={stage===level?'step':undefined}
     aria-label={stage+'단계 '+(stage<=level?'달성':'미달성')}
     style={{left:(50+45*Math.cos(angle))+'%',top:(50+45*Math.sin(angle))+'%'}}>
     {stage}
    </li>;
   })}
  </ol>
 </div>;
}
