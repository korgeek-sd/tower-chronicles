import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {JOB_CATALOG,JOB_RARITIES} from '../src/game/jobs/catalog.ts';
import {
 JOB_PICKUP_RATE,
 JOB_RECORD_EXCHANGE_COST,
 JOB_RECORD_EXCHANGE_LIMIT,
 JOB_RECORD_THRESHOLDS,
 JOB_RECOMMENDATION_COST,
 JOB_RECOMMENDATION_WEEKLY_LIMIT,
 JOB_REGISTRATION_COST_GOLD,
 JOB_REGISTRATION_RATES,
 JOB_RESIDUAL_VALUE,
 jobRegistrationGoldCost,
 jobRegistrationResultCount,
} from '../src/game/jobs/registration.ts';

const EXPANSION_JOB_IDS=[
 'green_crown_pilgrim','porter','guide',
 'relic_collector','monster_dismantler','expedition_archivist',
 'ascetic_priest','life_stitcher','subjugation_officer','rescuer','quartermaster','coroner','stair_scout',
 'green_crown_martyr','unity_apostle','deep_rescue_officer','boss_tracker','return_guardian','green_crown_inquisitor',
 'false_saint_proxy','hundred_battle_returnee',
] as const;

test('JOB REGISTRATION V1 01: rarity rates are C51 B30 A13 SR5 SSR1',()=>{
 assert.deepEqual(JOB_REGISTRATION_RATES,{C:.51,B:.30,A:.13,SR:.05,SSR:.01});
 assert.equal(Object.values(JOB_REGISTRATION_RATES).reduce((sum,value)=>sum+value,0),1);
});

test('JOB REGISTRATION V1 02: 1 pull costs 100G and 10 paid pulls cost 1000G for 11 results',()=>{
 assert.equal(JOB_REGISTRATION_COST_GOLD.single,100);
 assert.equal(JOB_REGISTRATION_COST_GOLD.ten,1000);
 assert.equal(jobRegistrationGoldCost(1),100);
 assert.equal(jobRegistrationGoldCost(10),1000);
 assert.equal(jobRegistrationResultCount(1),1);
 assert.equal(jobRegistrationResultCount(10),11);
});

test('JOB REGISTRATION V1 03: progression, residual values, and pickup rate match the spec',()=>{
 assert.deepEqual(JOB_RECORD_THRESHOLDS,{unlock:10,star2:30,star3:60});
 assert.deepEqual(JOB_RESIDUAL_VALUE,{C:1,B:2,A:4,SR:8,SSR:16});
 assert.equal(JOB_PICKUP_RATE,.5);
});

test('JOB REGISTRATION V1 04: server pool exposes the planned 48 jobs by rarity',()=>{
 const expected={C:8,B:10,A:12,SR:11,SSR:7} as const;
 for(const rarity of JOB_RARITIES)assert.equal(JOB_CATALOG.filter(job=>job.rarity===rarity).length,expected[rarity]);
 assert.equal(JOB_CATALOG.length,48);
});

test('JOB REGISTRATION V1 05: migration keeps RNG and payment server-authoritative with no pity path',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260927001016_job_registration_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/if r<0\.51 then return 'C'/);
 assert.match(sql,/if r<0\.81 then return 'B'/);
 assert.match(sql,/if r<0\.94 then return 'A'/);
 assert.match(sql,/if r<0\.99 then return 'SR'/);
 assert.match(sql,/v_cost:=p_paid_rolls\*100/);
 assert.match(sql,/p_paid_rolls=10 then 11 else 1/);
 assert.match(sql,/job_registration_secure_unit\(\)<0\.5/);
 assert.doesNotMatch(sql,/pity|천장/i);
});

test('JOB REGISTRATION V1 06: residual record exchange costs and shared quotas match the final spec',()=>{
 assert.deepEqual(JOB_RECORD_EXCHANGE_COST,{C:5,B:10,A:20,SR:50,SSR:160});
 assert.deepEqual(JOB_RECORD_EXCHANGE_LIMIT,{C:10,B:8,A:5,SR:2,SSR:1});
 assert.equal(JOB_RECOMMENDATION_COST,30);
 assert.equal(JOB_RECOMMENDATION_WEEKLY_LIMIT,3);
});

test('JOB REGISTRATION V1 07: completion migration keeps exchange server-authoritative and idempotent',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260927080946_complete_job_registration_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/exchange_job_residual_record/);
 assert.match(sql,/exchange_job_residual_recommendation/);
 assert.match(sql,/JOB_RECORD_EXCHANGE_LIMIT/);
 assert.match(sql,/JOB_RECOMMENDATION_WEEKLY_LIMIT/);
 assert.match(sql,/primary key\(user_id,request_id\)/);
 assert.match(sql,/Asia\/Seoul/);
 assert.match(sql,/when 'SSR' then 160/);
 assert.match(sql,/when 'SSR' then 1/);
 assert.match(sql,/if v_record_count>=60 then raise exception 'JOB_RECORD_MAXED'/);
});

test('JOB REGISTRATION V1 08: expansion migration registers all 21 planned catalog-only jobs',()=>{
 const migration=new URL('../supabase/migrations/20261001135500_expand_job_catalog_to_48.sql',import.meta.url);
 assert.equal(existsSync(migration),true);
 const sql=readFileSync(migration,'utf8');
 for(const jobId of EXPANSION_JOB_IDS)assert.match(sql,new RegExp(`'${jobId}'`));
});
