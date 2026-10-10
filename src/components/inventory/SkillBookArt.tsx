import React from 'react';
import {assetUrl} from '../../game/data/graphics';
import './skillbook-art.css';

export function SkillBookArt({grade}:{grade?:string}){
 return <img className={'tc-skillbook-art tc-skillbook-grade-'+(grade??'C').toLowerCase()} src={assetUrl('assets/ui/skillbook.jpg')} alt="" aria-hidden="true" draggable={false} width={64} height={64}/>;
}
