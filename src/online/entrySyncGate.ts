/** A cloud sync may start only after the active lease's first authoritative
 * record was loaded/created. Prevents first-login SAVE_CONFLICT (two writers). */
export interface EntryLeaseIdentity{leaseId:string;generation:number}
export const entrySyncOwner=(lease:EntryLeaseIdentity)=>lease.leaseId+':'+lease.generation;
export function isEntryCloudSyncReady(lease:EntryLeaseIdentity|null,readyOwner:string|null):boolean{
 return lease!==null&&readyOwner!==null&&entrySyncOwner(lease)===readyOwner;
}
