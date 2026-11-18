import React,{useState,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {PixiBoxStage} from './components/inventory/PixiBoxStage';
import './components/inventory/adventurer-box.css';
function Preview(){
 const [time,setTime]=useState<number|undefined>(undefined),[key,setKey]=useState(0),[status,setStatus]=useState('loading');
 const report=useCallback((value:string)=>setStatus(value),[]);
 return <main style={{maxWidth:420,margin:'auto',color:'#eed8a8',textAlign:'center',fontFamily:'sans-serif'}}>
 <h2>픽셀 전격 · 실제 재생</h2><p>{status}</p>
 <div style={{height:470,position:'relative',overflow:'hidden',background:'linear-gradient(#08080888,#08080866),url(/assets/backgrounds/summon/summon-altar-v1.webp) center/cover'}}>
 <div className="tc-box-altar" data-box-renderer={status} style={{width:'90%',margin:'70px auto 0'}}><PixiBoxStage key={key} feedback={{grade:'rare',duration:3100,chargeAt:650,holdAt:1450,burstAt:1620}} onStatus={report} previewTime={time}/></div></div>
 <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:16}}>{[['재생',undefined],['충전',1],['과부하',1.4],['개봉',2],['잔류',2.75]].map(([label,t])=><button style={{padding:14}} key={String(label)} onClick={()=>{setTime(t as number|undefined);setKey(k=>k+1);}}>{label}</button>)}</div>
 </main>;
}
document.body.style.background='#0b0d13';createRoot(document.getElementById('root')!).render(<Preview/>);
