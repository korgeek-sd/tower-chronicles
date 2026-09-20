import type {GameState} from '../../game/types';
import {equippedItem,itemName,stats} from '../../game/engine/state';
export function homeSummary(game:GameState){
 const equipment=game.expedition?.equipment??game.equipped,weapon=equippedItem(game,'weapon',equipment);
 return {maxHp:stats(game,equipment).hp,currentHp:game.expedition?.hp??null,weaponName:weapon?itemName(weapon):'장착한 무기 없음',highestReturned:game.exploration.highestReturned.ore,primaryPage:game.expedition?'battle' as const:'towers' as const,primaryLabel:game.expedition?'원정으로 돌아가기':'탐사 준비'};
}
