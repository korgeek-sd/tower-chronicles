import {chooseInitialClass,initialClassProgress,normalizeClassProgress,type ClassId,type ClassProgress} from '../../game/classes/progression';

type ClassStorage=Pick<Storage,'getItem'|'setItem'>;
export const onboardingClassKey=(userId:string)=>'tower-class-progression-v1:'+userId;
export const storySeenKey=(userId:string)=>'tower-new-player-story-v1:'+userId;

/** Only onboarding uses this marker. The existing eight-chapter story is unchanged. */
export function hasOnboardingStorySeen(storage:Pick<Storage,'getItem'>,userId:string):boolean{
 try{return storage.getItem(storySeenKey(userId))==='1';}catch{return false;}
}
export function markOnboardingStorySeen(storage:Pick<Storage,'setItem'>,userId:string):void{
 try{storage.setItem(storySeenKey(userId),'1');}catch{/* blocked storage must not prevent onboarding */ }
}
/** Read the same device-local class record as ClassProfessionScreen. */
export function readOnboardingClass(userId:string,storage:Pick<Storage,'getItem'>):ClassId|null{
 try{return normalizeClassProgress(JSON.parse(storage.getItem(onboardingClassKey(userId))??'null')).classId;}
 catch{return null;}
}
/** Save initial class without altering any already-selected profession or skills. */
export function saveOnboardingClass(userId:string,id:ClassId,storage:ClassStorage):void{
 const key=onboardingClassKey(userId);
 const existing=normalizeClassProgress(JSON.parse(storage.getItem(key)??'null'));
 if(existing.classId&&existing.classId!==id)throw new Error('이미 선택된 직업은 변경할 수 없습니다.');
 const selected=chooseInitialClass(existing,id);
 if(selected.classId!==id)throw new Error('직업을 선택하지 못했습니다.');
 storage.setItem(key,JSON.stringify(selected));
}

/** Server choice is authoritative across devices. Preserve talent selections
 * only when they belong to that same class. */
export function adoptPermanentClass(userId:string,id:ClassId,storage:ClassStorage):ClassProgress{
 const key=onboardingClassKey(userId);
 let local:ClassProgress;
 try{local=normalizeClassProgress(JSON.parse(storage.getItem(key)??'null'));}
 catch{local=initialClassProgress();}
 const next=local.classId===id?local:chooseInitialClass(initialClassProgress(),id);
 storage.setItem(key,JSON.stringify(next));
 return next;
}
