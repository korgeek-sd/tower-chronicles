export type GameSettings={shake:boolean;particles:boolean;ssrReveal:boolean;reducedMotion:boolean};
export const DEFAULT_SETTINGS:GameSettings={shake:true,particles:true,ssrReveal:true,reducedMotion:false};
const KEY='tc-presentation-settings-v1';
let cached:GameSettings|undefined;
export function normalizeSettings(value:unknown):GameSettings{const v=value&&typeof value==='object'?value as Record<string,unknown>:{};return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k,d])=>[k,typeof v[k]==='boolean'?v[k]:d])) as GameSettings;}
export function loadSettings():GameSettings{if(cached)return cached;try{cached=normalizeSettings(JSON.parse(localStorage.getItem(KEY)??'{}'));}catch{cached={...DEFAULT_SETTINGS};}return cached;}
export function saveSettings(value:GameSettings):boolean{cached=normalizeSettings(value);try{localStorage.setItem(KEY,JSON.stringify(value));applySettings(value);return true;}catch{applySettings(value);return false;}}
export function applySettings(value=loadSettings()){if(typeof document==='undefined')return;document.documentElement.dataset.tcShake=String(value.shake&&!value.reducedMotion);document.documentElement.dataset.tcParticles=String(value.particles&&!value.reducedMotion);document.documentElement.dataset.tcReducedMotion=String(value.reducedMotion);}
export function reducedMotion(){return loadSettings().reducedMotion||!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
