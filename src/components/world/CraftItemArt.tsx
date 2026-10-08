import React from 'react';
import type {ProductId} from '../../game/life/crafting';
import {assetUrl} from '../../game/data/graphics';
type CraftArtId=ProductId|'herb'|'pepper'|'potato'|'wheat'|'stone';
/** Approved pixel-art inventory assets, sharing a silver frame without tier badges. */
export function CraftItemArt({id}:{id:CraftArtId}){
 return <img className="tc-craft-art" data-craft-art={id} src={assetUrl(`assets/ui/crafting/${id}.png`)} alt="" aria-hidden="true" draggable={false} width={64} height={64} style={{objectFit:'contain'}}/>;
}
