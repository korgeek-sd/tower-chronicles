export type GameFeelIntensity='subtle'|'normal'|'strong'|'exceptional';
export type EnhancementFeelOutcome='SUCCESS'|'FAIL_KEEP'|'FAIL_DOWNGRADE'|'FAIL_DESTROY';
export type GameFeelEvent=
 |'hunt.start'|'hunt.result'
 |'ui.press'|'ui.confirm'|'ui.error'
 |'seal.roll.start'|'seal.roll.result'|'seal.reset'
 |'enhancement.attempt'|'enhancement.result'
 |'combat.basic-hit'|'combat.critical-hit'|'combat.player-damaged'|'combat.guard'|'combat.heal'|'combat.death'
 |'market.order-placed'|'market.order-cancelled'|'market.trade-partial'|'market.trade-filled';
export type GameFeelPayloadMap={
 'hunt.start':undefined;'hunt.result':{outcome:'victory'|'defeat';grade?:string};
 'ui.press':undefined;'ui.confirm':undefined;'ui.error':undefined;
 'seal.roll.start':undefined;'seal.roll.result':{step:1|2|3};'seal.reset':undefined;
 'enhancement.attempt':undefined;'enhancement.result':{outcome:EnhancementFeelOutcome};
 'combat.basic-hit':undefined;'combat.critical-hit':undefined;
 'combat.player-damaged':{intensity?:GameFeelIntensity}|undefined;
 'combat.guard':undefined;'combat.heal':undefined;'combat.death':undefined;
 'market.order-placed':undefined;'market.order-cancelled':undefined;'market.trade-partial':undefined;'market.trade-filled':undefined;
};
export type GameFeelCommand=
 |{kind:'press'}
 |{kind:'pulse';tone?:'neutral'|'positive'|'negative'|'gold'}
 |{kind:'flash';tone:'neutral'|'positive'|'negative'|'gold'}
 |{kind:'shake';strength:'light'|'medium'|'heavy'}
 |{kind:'burst';tone:'neutral'|'positive'|'negative'|'gold'}
 |{kind:'particles';tone:'gold'|'negative'}
 |{kind:'value-pop'}
 |{kind:'haptic';intensity:GameFeelIntensity};
export type GameFeelRecipe={key:string;event:GameFeelEvent;intensity:GameFeelIntensity;duration:number;commands:GameFeelCommand[]};
