import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RESOURCE_STRONGHOLD_PVP_RULES,contestDecisionEndsAt,takeoverCaptureEndsAt,
} from '../src/game/events/resourceStrongholdContest.ts';

test('STRONGHOLD PVP RULES 01: capture and normal contest choice windows are server constants',()=>{
 assert.equal(RESOURCE_STRONGHOLD_PVP_RULES.captureMs,15*60_000);
 assert.equal(RESOURCE_STRONGHOLD_PVP_RULES.decisionMs,30_000);
 assert.equal(contestDecisionEndsAt(1_000,121_001),31_000);
});

test('STRONGHOLD PVP RULES 02: a contest requested with at most one minute left gets remaining time times 1.5',()=>{
 assert.equal(contestDecisionEndsAt(10_000,70_000),100_000);
 assert.equal(contestDecisionEndsAt(10_000,50_000),70_000);
 assert.equal(contestDecisionEndsAt(10_000,70_001),40_000);
});

test('STRONGHOLD PVP RULES 03: takeover inherits the remaining time and adds half of it',()=>{
 assert.equal(takeoverCaptureEndsAt(100_000,200_000),250_000);
 assert.equal(takeoverCaptureEndsAt(100_000,100_000),100_000);
});
