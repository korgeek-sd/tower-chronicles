import React from 'react';
import {GRADES} from '../../game/skills/catalog';

const equipmentGrades=[['all','전체'],['common','일반'],['uncommon','고급'],['rare','희귀'],['heroic','영웅'],['legendary','전설']];
export function marketGradeMatches(item:{category:string;skillBookGrade?:string;gear?:object},grade:string){
 return grade==='all'||(item.category==='skillbooks'?item.skillBookGrade===grade:item.category==='equipment'&&!!item.gear&&'grade' in item.gear&&item.gear.grade===grade);
}
export function MarketGradeFilters({category,value,onChange}:{category:string;value:string;onChange:(grade:string)=>void}){
 if(category!=='equipment'&&category!=='skillbooks')return null;
 const books=category==='skillbooks',options=books?[['all','전체'],...GRADES.map(grade=>[grade,grade])]:equipmentGrades;
 return <div className={'tc-market-grade-filters'+(books?' tc-market-book-grades':'')} role="group" aria-label={books?'스킬북 등급':'장비 등급'}>{options.map(([key,label])=><button key={key} className={'grade-'+(books?key.toLowerCase():key)+(value===key?' active':'')} aria-pressed={value===key} onClick={()=>onChange(key)}>{label}</button>)}</div>;
}
