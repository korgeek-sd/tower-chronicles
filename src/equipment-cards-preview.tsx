import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AdventurerBoxDialog} from './components/inventory/AdventurerBoxDialog';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADES} from './game/data/equipment';
import type {EquipmentItem,EquipmentKind} from './game/types';
function Preview(){
 const [count,setCount]=useState(10),[show,setShow]=useState(false),[rewards,setRewards]=useState<EquipmentItem[]|null>(null);
 const open=()=>{const kinds=Object.keys(EQUIPMENT_DEFINITIONS) as EquipmentKind[];setRewards(Array.from({length:count},(_,i)=>({id:`preview-${count}-${i}`,kind:kinds[i%kinds.length],grade:EQUIPMENT_GRADES[i%5],enhancement:0})));};
 return <main style={{maxWidth:480,margin:'30px auto',padding:20,textAlign:'center',color:'#efdfbf',fontFamily:'sans-serif'}}><h1>장비 카드 UI 미리보기</h1><p>테스트용 장비를 표시합니다. 실제 상자는 소비하지 않습니다.</p><button style={{padding:16,fontSize:18}} onClick={()=>{setRewards(null);setShow(true);}}>상자 사용 화면 열기</button>{show&&<AdventurerBoxDialog quantity={10} count={count} onCount={setCount} busy={false} pending={false} error="" disabled={false} rewards={rewards} onOpen={open} onRepeat={open} onRetry={()=>{}} onClose={()=>setShow(false)}/>}</main>;
}
document.body.style.background='#0c0c10';createRoot(document.getElementById('root')!).render(<Preview/>);
