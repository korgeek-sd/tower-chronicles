import type {JobRarity} from './catalog';

export const JOB_REGISTRATION_RATES:Readonly<Record<JobRarity,number>>={
 C:0.51,
 B:0.30,
 A:0.13,
 SR:0.05,
 SSR:0.01,
};

export const JOB_REGISTRATION_COST_GOLD={
 single:100,
 ten:1000,
} as const;

export type JobRegistrationPaidRolls=1|10;

export const jobRegistrationResultCount=(paidRolls:JobRegistrationPaidRolls)=>paidRolls===10?11:1;
export const jobRegistrationGoldCost=(paidRolls:JobRegistrationPaidRolls)=>paidRolls===10?JOB_REGISTRATION_COST_GOLD.ten:JOB_REGISTRATION_COST_GOLD.single;

export const JOB_RECORD_THRESHOLDS={
 unlock:10,
 star2:30,
 star3:60,
} as const;

export const JOB_RESIDUAL_VALUE:Readonly<Record<JobRarity,number>>={
 C:1,
 B:2,
 A:4,
 SR:8,
 SSR:16,
};

export const JOB_RECORD_EXCHANGE_COST:Readonly<Record<JobRarity,number>>={
 C:5,
 B:10,
 A:20,
 SR:50,
 SSR:160,
};

export const JOB_RECORD_EXCHANGE_LIMIT:Readonly<Record<JobRarity,number>>={
 C:10,
 B:8,
 A:5,
 SR:2,
 SSR:1,
};

export const JOB_RECOMMENDATION_COST=30;
export const JOB_RECOMMENDATION_WEEKLY_LIMIT=3;
export const JOB_PICKUP_RATE=0.5;
