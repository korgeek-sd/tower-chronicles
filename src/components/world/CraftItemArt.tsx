import React from 'react';
import type {ProductId} from '../../game/life/crafting';
import {assetUrl} from '../../game/data/graphics';
type CraftArtId=ProductId|'herb'|'pepper'|'potato'|'wheat'|'stone';
const FOOD_ART_VERSIONS:Partial<Record<CraftArtId,string>>={attack_food:'85dd0249f609',defense_food:'d8949ad574d0'};
/** Approved pixel-art inventory assets, sharing a silver frame without tier badges. */
export function CraftItemArt({id}:{id:CraftArtId}){
 const version=FOOD_ART_VERSIONS[id];
 return <img className="tc-craft-art" data-craft-art={id} src={assetUrl(`assets/ui/crafting/${id}.png${version?`?v=${version}`:''}`)} alt="" aria-hidden="true" draggable={false} width={64} height={64}/>;
}
