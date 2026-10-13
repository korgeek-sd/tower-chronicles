import React from 'react';
import {GradeChips,equipmentGradeOptions,bookGradeOptions} from '../filters/LucianFilters';
export function marketGradeMatches(item:{category:string;skillBookGrade?:string;gear?:object},grade:string|readonly string[]){
 const grades=typeof grade==='string'?(grade==='all'?[]:[grade]):grade;
 return !grades.length||grades.includes(item.category==='skillbooks'?item.skillBookGrade??'':item.category==='equipment'&&item.gear&&'grade' in item.gear?String(item.gear.grade):'');
}
export function MarketGradeFilters({category,value,onChange}:{category:string;value:string|readonly string[];onChange:(grades:string[])=>void}){
 if(category!=='equipment'&&category!=='skillbooks')return null;
 const books=category==='skillbooks',grades=typeof value==='string'?(value==='all'?[]:[value]):value;
 return <GradeChips className={'tc-market-grade-filters'+(books?' tc-market-book-grades':'')} label={books?'스킬북 등급':'장비 등급'} options={books?bookGradeOptions:equipmentGradeOptions} value={grades} onChange={onChange}/>;
}
