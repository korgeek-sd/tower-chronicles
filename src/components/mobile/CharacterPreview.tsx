import React,{useEffect,useState} from 'react';
import {assetUrl,playerGraphicFor} from '../../game/data/graphics';
import {Glyph} from '../../ui/mobile';

function useReady(path?:string){
 const [ready,setReady]=useState(false);
 useEffect(()=>{setReady(false);if(!path)return;let active=true;const img=new Image();img.onload=()=>{if(active)setReady(true);};img.onerror=()=>{if(active)setReady(false);};img.src=assetUrl(path);return()=>{active=false;img.onload=null;img.onerror=null;};},[path]);
 return !!path&&ready;
}

export function CharacterPreview({appearanceId}:{appearanceId:string}){
 const graphic=playerGraphicFor(appearanceId),path=graphic.image.idle,ready=useReady(path);
 return <div className="tc-character-figure">{ready&&path?<img src={assetUrl(path)} alt="모험가"/>:<Glyph name="cosmetics"/>}</div>;
}
