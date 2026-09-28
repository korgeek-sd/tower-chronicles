export const RESOURCE_STRONGHOLD_PVP_RULES={
 captureMs:15*60_000,
 decisionMs:30_000,
 urgentThresholdMs:60_000,
 urgentMultiplier:1.5,
 takeoverMultiplier:1.5,
 destructionChance:.15,
} as const;

export function contestDecisionEndsAt(now:number,captureEndsAt:number){
 const remaining=Math.max(0,captureEndsAt-now);
 const window=remaining<=RESOURCE_STRONGHOLD_PVP_RULES.urgentThresholdMs
  ?Math.floor(remaining*RESOURCE_STRONGHOLD_PVP_RULES.urgentMultiplier)
  :RESOURCE_STRONGHOLD_PVP_RULES.decisionMs;
 return now+window;
}

export function takeoverCaptureEndsAt(now:number,previousCaptureEndsAt:number){
 const remaining=Math.max(0,previousCaptureEndsAt-now);
 return now+Math.floor(remaining*RESOURCE_STRONGHOLD_PVP_RULES.takeoverMultiplier);
}
