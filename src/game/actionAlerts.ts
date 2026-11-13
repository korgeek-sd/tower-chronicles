import type {QuestBoard} from '../online/quests';
import type {FreeAttendanceStatus} from '../online/freeAttendance';

/** A dot represents a claimable reward, never merely unfinished progression. */
export function hasClaimableQuestRewards(board:Pick<QuestBoard,'daily'|'weekly'>|null|undefined):boolean{
 return !!board&&[...board.daily,...board.weekly].some(q=>q.completed&&!q.claimed);
}

/** Server time and cycle boundaries are decided by the attendance RPC. */
export function hasUnclaimedAttendance(status:Pick<FreeAttendanceStatus,'todayClaimed'>|null|undefined):boolean{
 return status?.todayClaimed===false;
}
