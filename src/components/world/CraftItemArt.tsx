import React from 'react';
import type {ProductId} from '../../game/life/crafting';
import {assetUrl} from '../../game/data/graphics';
type CraftArtId=ProductId|'herb'|'pepper'|'potato'|'wheat'|'stone';
const FOOD_ART_VERSIONS:Partial<Record<CraftArtId,string>>={attack_food:'6ff383bee75a',defense_food:'41c4653c3d58',experience_food:'07c147880a14'};
/** Approved pixel-art inventory assets, sharing a silver frame without tier badges. */
export function CraftItemArt({id}:{id:CraftArtId}){
 const version=FOOD_ART_VERSIONS[id];
 return <img className="tc-craft-art" data-craft-art={id} src={assetUrl(`assets/ui/crafting/${id}.png${version?`?v=${version}`:''}`)} alt="" aria-hidden="true" draggable={false} width={64} height={64}/>;
}
