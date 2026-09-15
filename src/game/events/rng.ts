/** Shared injectable RNG boundary for expedition rolls and combat rewards. */
export type Rng=()=>number;
export const random:Rng=()=>Math.random();
export function unit(rng:Rng){const value=rng();if(!Number.isFinite(value)||value<0||value>=1)throw Error('RNG must return a value in [0, 1).');return value;}
export function weighted<T extends {weight:number}>(pool:readonly T[],rng:Rng):T|null {const entries=pool.filter(x=>Number.isFinite(x.weight)&&x.weight>0);const total=entries.reduce((n,x)=>n+x.weight,0);if(!entries.length)return null;let roll=unit(rng)*total;for(const entry of entries){roll-=entry.weight;if(roll<0)return entry;}return entries[entries.length-1];}
