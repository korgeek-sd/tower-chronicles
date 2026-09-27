export type GameFeelIntensity='subtle'|'normal'|'strong'|'exceptional';

export const GAME_FEEL_EVENTS=[
 'ui.press','ui.confirm','ui.error',
 'seal.roll.start','seal.roll.result','seal.reset',
 'enhancement.attempt','enhancement.result',
 'combat.basic-hit','combat.critical-hit','combat.player-damaged','combat.guard','combat.heal','combat.death',
 'market.order-placed','market.order-cancelled','market.trade-partial','market.trade-filled',
] as const;

export type GameFeelEvent=typeof GAME_FEEL_EVENTS[number];
export type EnhancementFeelOutcome='SUCCESS'|'FAIL_KEEP'|'FAIL_DOWNGRADE'|'FAIL_DESTROYED';

export interface GameFeelPayloadMap {
 'ui.press':undefined;
 'ui.confirm':undefined;
 'ui.error':{message?:string}|undefined;
 'seal.roll.start':undefined;
 'seal.roll.result':{step:1|2|3};
 'seal.reset':undefined;
 'enhancement.attempt':undefined;
 'enhancement.result':{outcome:EnhancementFeelOutcome;target?:number};
 'combat.basic-hit':{intensity?:GameFeelIntensity}|undefined;
 'combat.critical-hit':undefined;
 'combat.player-damaged':{intensity?:GameFeelIntensity}|undefined;
 'combat.guard':undefined;
 'combat.heal':undefined;
 'combat.death':undefined;
 'market.order-placed':undefined;
 'market.order-cancelled':undefined;
 'market.trade-partial':undefined;
 'market.trade-filled':undefined;
}

export type GameFeelTone='neutral'|'brass'|'positive'|'negative'|'rare'|'defense'|'heal';
export type GameFeelTarget='control'|'source'|'target'|'screen'|'value';

export type GameFeelCommand=
 |{type:'press';duration:number;target?:GameFeelTarget}
 |{type:'pulse';duration:number;tone:GameFeelTone;target?:GameFeelTarget}
 |{type:'flash';duration:number;tone:GameFeelTone;target?:GameFeelTarget}
 |{type:'shake';duration:number;strength:'light'|'medium'|'heavy';target?:GameFeelTarget}
 |{type:'burst';duration:number;tone:GameFeelTone;target?:GameFeelTarget}
 |{type:'particles';duration:number;tone:GameFeelTone;count:number;target?:GameFeelTarget}
 |{type:'value-pop';duration:number;tone:GameFeelTone;target?:GameFeelTarget}
 |{type:'haptic';intensity:GameFeelIntensity};

export interface GameFeelRecipe {
 event:GameFeelEvent;
 intensity:GameFeelIntensity;
 duration:number;
 commands:readonly GameFeelCommand[];
}
