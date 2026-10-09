import React from 'react';
import './inventory.css';
import type {EquipmentKind,EquipmentGrade} from '../../game/types';
import {assetUrl} from '../../game/data/graphics';
export function EquipmentArt({kind,grade}:{kind:EquipmentKind;grade?:EquipmentGrade}){
 return <img className={"tc-equipment-art"+(grade?" tc-equipment-grade-"+grade:"")} src={assetUrl(`assets/ui/equipment/${kind}.png`)} alt="" aria-hidden="true" draggable={false} width={64} height={64}/>;
}
