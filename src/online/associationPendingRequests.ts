type RequestStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const prefix='tower-growth-pending:';

export function pendingGrowthRequest(key:string,storage:RequestStorage=sessionStorage){
 const stored=storage.getItem(prefix+key);
 if(stored)return stored;
 const id=crypto.randomUUID();storage.setItem(prefix+key,id);return id;
}
export function completeGrowthRequest(key:string,storage:RequestStorage=sessionStorage){storage.removeItem(prefix+key);}
