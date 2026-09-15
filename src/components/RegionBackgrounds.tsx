import React,{useState} from 'react';
import type {Tower} from '../game/types';
import {backgroundFor,assetUrl} from '../game/data/graphics';
import {REGIONS} from '../game/engine/exploration';
export function RegionBackgrounds({tower}:{tower:Tower}){
 const [tier,setTier]=useState(1);
 return <section className="region-preview"><div className="region-image">{tower==='kaleon'?<p>배경 이미지 준비 중</p>:<img src={assetUrl(backgroundFor(tower,(tier-1)*10+1))} alt={REGIONS[tower][tier-1]}/>}<div><strong>T{tier} · {REGIONS[tower][tier-1]}</strong><span>{(tier-1)*10+1}~{tier*10}층 · 보스 {tier*10}층</span></div></div><div className="region-tabs" aria-label="티어별 배경 미리보기">{[1,2,3,4,5].map(t=><button key={t} aria-pressed={t===tier} onClick={()=>setTier(t)}>T{t}<small>{(t-1)*10+1}~{t*10}층</small></button>)}</div><p>배경 미리보기 · 실제 입장은 아래 목표 층에서 선택합니다.</p></section>;
}
