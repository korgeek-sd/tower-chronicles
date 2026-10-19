import type {GameState} from '../game/types';

/** Server records replace local balances and entitlements, including lower values. */
export function mergeServerRecordState(serverPayload: GameState): GameState {
 return serverPayload;
}
