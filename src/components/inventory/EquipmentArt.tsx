import React from 'react';
import './inventory.css';
import type {EquipmentKind} from '../../game/types';
import {assetUrl} from '../../game/data/graphics';
export function EquipmentArt({kind}:{kind:EquipmentKind}){
 return <img className="tc-equipment-art" src={assetUrl(`assets/ui/equipment/${kind}.png`)} alt="" aria-hidden="true" draggable={false} width={64} height={64}/>;
}
