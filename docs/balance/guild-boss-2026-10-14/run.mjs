import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import {gunzipSync} from 'node:zlib';
const SKILL_TREE_CATALOG = JSON.parse(readFileSync(new URL('./skills.json', import.meta.url), 'utf8'));
// Frozen level-budget adapter: one assignable point from Lv2 to Lv100.
const statPointsForLevel = (level) => Math.max(0, Math.min(99, Math.floor(level) - 1));
const out = fileURLToPath(new URL('./', import.meta.url));
mkdirSync(out, { recursive: true });
const snapshot = readFileSync(new URL('./engine.sql', import.meta.url), 'utf8');
function fn(path, name) { const sql = snapshot; const start = sql.toLowerCase().indexOf('create or replace function private.' + name + '('); assert.ok(start >= 0, name); const rest = sql.slice(start); const tag = rest.match(/\bas\s+(\$[a-zA-Z_]*\$)/i)[1]; const at = rest.indexOf(tag); const end = rest.indexOf(tag, at + tag.length); assert.ok(end > at, name); return rest.slice(0, end + tag.length) + ';'; }
const files = { fixed_equipment_stats: 'supabase/migrations/20261008142245_fixed_equipment_catalog.sql', association_seal_bonus_json: 'supabase/migrations/20260927114500_association_seal_v1.sql', combat_equipment_stats: 'supabase/migrations/20261010130000_hunting_stat_allocation.sql', hunting_damage: 'supabase/migrations/20261008100000_hunting_six_stats.sql', hunting_skill_spec: 'supabase/migrations/20261011194500_hunting_catalog_combat.sql', guild_boss_combat: 'supabase/migrations/20261014113600_guild_boss_daily_weekly.sql' };
const functions = Object.entries(files).map(([name, path]) => ({ name, path, sql: fn(path, name) }));
writeFileSync(out + 'engine.sql', functions.map(f => f.sql).join('\n\n'));
const db = new PGlite();
const user = '11111111-1111-4111-8111-111111111111';
const fixture = `create schema private;create table private.hunting_states(user_id uuid primary key,skills text[],stat_allocation jsonb);create table private.learned_catalog_skills(user_id uuid,skill_id text,enhancement_level integer);create table private.skill_book_catalog(skill_id text,name text);create table private.market_assets(user_id uuid,item_id text,quantity bigint,gear jsonb);create table private.player_association_seals(user_id uuid,level integer);create table private.guild_boss_encounters(encounter_id uuid,association_id uuid,kind text,cycle_start timestamptz,cycle_end timestamptz,boss_name text,max_hp bigint,remaining_hp bigint,attack_power numeric,defense_power numeric,total_attacks bigint,defeated_at timestamptz,created_at timestamptz);insert into private.hunting_states values('${user}',array[]::text[],'{}');`;
writeFileSync(out + 'fixture.sql', fixture);
console.log('loading database');
await db.exec(fixture);
for (const f of functions)
    await db.exec(f.sql);
console.log('database ready');
for (const s of SKILL_TREE_CATALOG) {
    await db.query('insert into private.skill_book_catalog values($1,$2)', [s.id, s.name]);
    await db.query('insert into private.learned_catalog_skills values($1::uuid,$2,0)', [user, s.id]);
}
const weapons = { sword: 'association_supply_iron_sword', bow: 'outer_guard_longbow', staff: 'archive_standard_arcane_staff' };
const slots = { helmet: 'expedition_iron_helmet', armor: 'return_corps_plate_armor', gloves: 'mining_detail_reinforced_gloves', boots: 'survey_corps_dust_boots', necklace: 'association_registration_tag', ring: 'expedition_merit_ring' };
const fractions = { balanced: [.30, .35, .30, .05, 0], offense: [.12, .70, .13, .05, 0], defense: [.45, .15, .35, .05, 0], critical: [.20, .35, .20, .25, 0], mana: [.15, .35, .15, .05, .30], unspent: [0, 0, 0, 0, 0] };
function allocate(level, build) { const total = statPointsForLevel(level), parts = fractions[build]; const a = parts.map(f => Math.floor(total * f)); a[3] = Math.min(10, a[3]); let left = total - a.reduce((s, n) => s + n, 0); const order = parts.map((_, i) => i).filter(i => parts[i] > 0).sort((a, b) => parts[b] - parts[a] || a - b); if (build !== 'unspent')
    while (left > 0)
        for (const i of order) {
            if (!left)
                break;
            if (i === 3 && a[3] >= 10)
                continue;
            a[i]++;
            left--;
        } return Object.fromEntries(['hp', 'attack', 'defense', 'crit', 'mp'].map((k, i) => [k, a[i]])); }
function preset(weapon, tier, order = 'damage') { if (tier === 'legacy')
    return ['heavy', 'guard', 'quick']; const families = weapon === 'sword' ? ['sword_strike', 'sword_wound'] : weapon === 'bow' ? ['bow_shot', 'bow_volley'] : ['staff_flame', 'staff_rift']; const suffix = tier.toLowerCase(); const active = [...families, 'restore', 'heal', 'shield', 'prepare'].map(f => f + '_' + suffix); if (order === 'support')
    active.unshift(...active.splice(2)); const passives = [weapon + '_mastery_' + suffix]; if (tier === 'SSR')
    passives.push('return_oath_ssr', 'sixth_mark_ssr'); return [...passives, ...active]; }
async function configure(s) { const equipment = {}; await db.exec('delete from private.market_assets;'); let i = 0; const kinds = { weapon: weapons[s.weapon], ...slots }; for (const [slot, kind] of Object.entries(kinds)) {
    if (s.gearMode === 'none' || (s.gearMode === 'weapon' && slot !== 'weapon'))
        continue;
    const id = 'gear-' + (++i);
    equipment[slot] = id;
    const grade = s.variant === 'weapon-upgrade' && slot === 'weapon' ? 'rare' : s.grade;
    await db.query('insert into private.market_assets values($1::uuid,$2,1,$3::jsonb)', [user, 'equipment_v2:' + id, JSON.stringify({ id, kind, grade, enhancement: 0 })]);
} const points = allocate(s.level, s.build); const skills = preset(s.weapon, s.tier, s.variant === 'support-first' ? 'support' : 'damage'); assert.ok(skills.length <= 9); await db.query('update private.hunting_states set skills=$1::text[],stat_allocation=$2::jsonb where user_id=$3::uuid', [skills, JSON.stringify(points), user]); await db.query('update private.learned_catalog_skills set enhancement_level=$1', [s.enhancement ?? 0]); const payload = { equipped: equipment, expedition: null }; const stat = (await db.query('select private.combat_equipment_stats($1::uuid,$2::jsonb) s', [user, JSON.stringify(payload)])).rows[0].s; return { payload, points, skills, stat }; }
await db.exec(`create function pg_temp.balance_trials(p_user uuid,p_payload jsonb,p_runs integer) returns table(i integer,r jsonb) language plpgsql as $$ declare e private.guild_boss_encounters%rowtype;trial integer;begin select * into e from private.guild_boss_encounters;for trial in 1..p_runs loop i:=trial;perform setseed(((trial::bigint*48271+20261014)%2147483647)::double precision/2147483647);r:=private.guild_boss_combat(p_user,e,p_payload);return next;end loop;end$$;`);
const summaries = [], csv = ['level,grade,weapon,build,tier,kind,variant,seed,outcome,turns,damage_taken,potions,xp,vitality,silver,damage,mp_left'];
const wilson = (count, n) => { const z = 1.96, value = count / n, den = 1 + z*z/n, mid = (value + z*z/(2*n))/den, margin = z*Math.sqrt(value*(1-value)/n + z*z/(4*n*n))/den;return [Math.max(0,mid-margin), Math.min(1,mid+margin)]; };
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const percentile = (v, p) => [...v].sort((a, b) => a - b)[Math.ceil(v.length * p) - 1];
async function run(s, runs) {
    const setup = await configure(s);
    const hp = s.kind === 'DAILY' ? 2400 : 24000, attack = s.kind === 'DAILY' ? 13 : 27, defense = s.kind === 'DAILY' ? 8 : 18;
    await db.query('delete from private.guild_boss_encounters');
    await db.query('insert into private.guild_boss_encounters(kind,boss_name,max_hp,remaining_hp,attack_power,defense_power) values($1,$2,$3,$3,$4,$5)', [s.kind, '측정 보스', hp, attack, defense]);
    const results = (await db.query(`select * from pg_temp.balance_trials($1::uuid,$2::jsonb,$3::integer)`, [user, JSON.stringify(setup.payload), runs])).rows;
    const values = results.map(x => Number(x.r.damage)), turns = results.map(x => x.r.turns.length);
    let deaths = 0, fullKills = 0;
    for (const { i, r } of results) {
        if (r.outcome === 'defeated')
            deaths++;
        if (r.damage === hp)
            fullKills++;
        csv.push([s.level, s.grade, s.weapon, s.build, s.tier, s.kind, s.variant ?? 'baseline', i, r.outcome, r.turns.length, Math.max(0, r.maxPlayerHp - r.playerHp), 0, 0, 0, 0, r.damage, r.playerMp].join(','));
    }
    const damage = mean(values), sd = Math.sqrt(values.reduce((a, x) => a + (x - damage) ** 2, 0) / Math.max(1, runs - 1));
    summaries.push({ ...s, runs, points: setup.points, skills: setup.skills, stats: setup.stat, bossHp: hp, meanDamage: damage, p10Damage: percentile(values, .1), p90Damage: percentile(values, .9), meanTurns: mean(turns), deathRate: deaths / runs, oneAttackKillRate: fullKills / runs, deathWilson95: wilson(deaths,runs), oneAttackKillWilson95: wilson(fullKills,runs), mean95Low: runs > 1 ? damage - 1.96 * sd / Math.sqrt(runs) : null, mean95High: runs > 1 ? damage + 1.96 * sd / Math.sqrt(runs) : null, estimatedAttempts: Math.ceil(hp / damage), estimatedDaysByMembers: Object.fromEntries([1, 3, 5, 10, 20].map(n => [n, s.kind === 'DAILY' ? (hp <= damage * 5 * n ? 1 : null) : Math.ceil(hp / (damage * 5 * n))])), estimatedClearableByMembers: Object.fromEntries([1, 3, 5, 10, 20].map(n => [n, Math.ceil(hp / damage) <= 5 * n * (s.kind === 'DAILY' ? 1 : 7)])) });
}
if (process.env.GUILD_BALANCE_SMOKE === '1') {
    const expected = gunzipSync(readFileSync(new URL('./trials.csv.gz', import.meta.url))).toString().trim().split(/\r?\n/).filter(line => line.startsWith('20,common,sword,balanced,A,WEEKLY,precision,')).slice(0,16);
    await run({level:20,grade:'common',weapon:'sword',build:'balanced',tier:'A',kind:'WEEKLY',variant:'precision'},16);
    assert.deepEqual(csv.slice(1),expected);
    await db.close();console.log('Smoke verified 16 seeded engine rows against the retained snapshot.');process.exit(0);
}
console.log('starting matrix');
await db.query('select setseed($1)', [.141026]);
const levels = [1, 20, 40, 60, 80, 100], grades = ['common', 'uncommon', 'rare', 'heroic', 'legendary'];
for (const level of levels) {
    for (const grade of grades)
        for (const weapon of Object.keys(weapons))
            for (const build of ['balanced', 'offense', 'defense', 'critical', 'mana'])
                for (const tier of ['C', 'A', 'SSR'])
                    for (const kind of ['DAILY', 'WEEKLY'])
                        await run({ level, grade, weapon, build, tier, kind }, 1);
    writeFileSync(out + 'summary.partial.json', JSON.stringify(summaries));
    console.log('screen level ' + level + ' complete, cases ' + summaries.length);
}
// Expanded estimates use independent seeds within PostgreSQL (not JavaScript RNG).
await db.query('select setseed($1)', [.42026]);
for (const level of [1, 20, 50, 80, 100])
    for (const tier of ['legacy', 'A', 'SSR'])
        for (const kind of ['DAILY', 'WEEKLY'])
            await run({ level, grade: level < 40 ? 'common' : level < 80 ? 'rare' : 'heroic', weapon: 'sword', build: tier === 'SSR' ? 'mana' : 'balanced', tier, kind, variant: 'refined' }, 128);
for (const weapon of Object.keys(weapons))
    for (const variant of ['support-first', 'enhanced', 'weapon-upgrade', 'unspent', 'no-gear', 'weapon-only'])
        for (const kind of ['DAILY', 'WEEKLY'])
            await run({ level: 80, grade: 'common', weapon, build: variant === 'unspent' ? 'unspent' : 'mana', tier: 'SSR', kind, variant, enhancement: variant === 'enhanced' ? 3 : 0, gearMode: variant === 'no-gear' ? 'none' : variant === 'weapon-only' ? 'weapon' : 'full' }, 32);
for (const level of [20, 80])
    await run({ level, grade: level === 20 ? 'common' : 'heroic', weapon: 'sword', build: 'balanced', tier: 'A', kind: 'WEEKLY', variant: 'precision' }, 1000);
await run({ level: 80, grade: 'heroic', weapon: 'sword', build: 'mana', tier: 'SSR', kind: 'WEEKLY', variant: 'precision' }, 1000);
writeFileSync(out + 'trials.csv', csv.join('\n') + '\n');
writeFileSync(out + 'summary.json', JSON.stringify(summaries, null, 2));
writeFileSync(out + 'config.json', JSON.stringify({ revision: 'fc3c19b6d0501ccd7fd55d8922389928319a8f25', levels, grades, screenRuns: 1, refinedRuns: 128, sensitivityRuns: 32, precisionRuns: 1000, seedSchedule: 'setseed(((trial_index*48271+20261014)%2147483647)/2147483647), reset independently before each fight; paired across scenarios', engine: 'production PostgreSQL guild_boss_combat loaded unchanged into PGlite', independentFullHpMp: true, sealLevel: 0, food: 'none (not applied by boss engine)', counts: summaries.length, trials: csv.length - 1, sourceHashes: functions.map(f => ({ name: f.name, path: f.path, sha256: createHash('sha256').update(f.sql).digest('hex') })), caveat: 'Trials execute sequentially with per-trial seeded PostgreSQL RNG. Guild-day estimates use mean damage and equal hypothetical members; no live player distributions.' }, null, 2));
console.log('written ' + summaries.length + ' cases / ' + (csv.length - 1) + ' trials');
await db.close();
