import React,{useState} from 'react';
import {inventoryIconPath} from './inventoryPresentation';
const labels:Record<string,string>={armor:'갑옷',boots:'신발',accessory:'장신구',ore:'철',leather:'가죽',gem:'수정',kaleon:'녹석',tickets:'입장권',skillbooks:'스킬북',cosmetics:'외형',other:'물품'};
export function InventoryIcon({id,tier}:{id:string;tier?:number}){
 const path=inventoryIconPath(id,tier),[failed,setFailed]=useState<string|null>(null);
 return path&&failed!==path?<img className="inventory-icon" src={path} alt="" onError={()=>setFailed(path)}/>:<span className="inventory-icon inventory-fallback" aria-hidden="true"><span>{labels[id]||'물품'}</span>{tier&&<small>T{tier}</small>}</span>;
}
