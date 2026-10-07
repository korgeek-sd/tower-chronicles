import test from 'node:test';import assert from 'node:assert/strict';
import {playCombatCharge,setCombatAudioEnabled,unlockCombatAudio,stopCombatAudio} from '../src/components/battle/combatAudio';
test('charge audio tolerates locked audio and cancels voices idempotently',()=>{
 assert.doesNotThrow(()=>playCombatCharge()());
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');let starts=0,stops=0,disconnects=0;
 const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 class Context{state='running';currentTime=0;destination={};createOscillator(){return{type:'',frequency:param,onended:null,start(){starts++;},stop(){stops++;},connect(){},disconnect(){disconnects++;}};}createGain(){return{gain:param,connect(){},disconnect(){disconnects++;}};}}
 Object.defineProperty(globalThis,'window',{configurable:true,value:{AudioContext:Context}});
 try{setCombatAudioEnabled(true);unlockCombatAudio();const cancel=playCombatCharge();assert.equal(starts,1);cancel();cancel();assert.equal(disconnects,2);assert.equal(stops,2);playCombatCharge();setCombatAudioEnabled(false);assert.equal(disconnects,4);playCombatCharge();assert.equal(starts,2);stopCombatAudio();assert.equal(disconnects,4);}
 finally{setCombatAudioEnabled(true);if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');}
});
