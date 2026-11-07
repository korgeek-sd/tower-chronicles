import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

const migrationDir=new URL('../supabase/migrations/',import.meta.url);
function migration(){
 const name=readdirSync(migrationDir).find(file=>file.endsWith('_association_shop_vitality_appearance.sql'));
 assert.ok(name,'Modern guild shop migration must be committed');
 return readFileSync(new URL(name!,migrationDir),'utf8');
}

test('guild shop sells the existing non-tradable vitality potion (not a new consumable)',()=>{
 const sql=migration();
 assert.match(sql,/vitality_potion_daily/);
 assert.match(sql,/활력 회복 포션/);
 assert.match(sql,/VITALITY_POTION/);
 assert.match(sql,/private\.grant_vitality_potions\(u,item\.reward_quantity\)/);
 assert.match(sql,/VALUES\s*\(\s*'vitality_potion_daily'/i);
 assert.match(sql,/\b500\s*,\s*1\s*,/);
 assert.match(sql,/private\.online_association_shop_items/);
});

test('shop removes discontinued enhancement stones and HP potions while preserving history',()=>{
 const sql=migration();
 for(const id of ['enhancement_stone_daily','enhancement_stone_weekly','greater_potion_daily','greater_potion_weekly'])assert.ok(sql.includes(id),id);
 assert.match(sql,/enabled\s*=\s*false/i);
 assert.doesNotMatch(sql,/delete\s+from\s+private\.online_association_shop_(?:items|purchases)/i);
});

test('old job ticket shop products now credit the existing appearance-summon wallet',()=>{
 const sql=migration();
 assert.match(sql,/job_draw_ticket_daily/);
 assert.match(sql,/job_draw_ticket_weekly/);
 assert.match(sql,/외형 소환권/);
 assert.match(sql,/APPEARANCE_TICKET/);
 assert.match(sql,/private\.appearance_ticket_wallets/);
 assert.match(sql,/on conflict\s*\(user_id\)\s*do update/i);
});
