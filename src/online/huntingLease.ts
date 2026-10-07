import type {GameplayLease} from './gameSession';
type Identity=Pick<GameplayLease,'leaseId'|'generation'|'clientInstanceId'>;
export function isHuntingLeaseCurrent(origin:Identity|null,current:Identity|null):boolean {
 return !!origin&&!!current&&origin.leaseId===current.leaseId&&origin.generation===current.generation&&origin.clientInstanceId===current.clientInstanceId;
}
