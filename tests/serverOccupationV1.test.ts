import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928072000_occupation_war_v0165.sql',import.meta.url),'utf8');

test('OCCUPATION SERVER 01: server stores tower merit bids matches fronts participants and duels privately',()=>{
 for(const table of ['occupation_tower_state','occupation_merit','occupation_bids','occupation_matches','occupation_front_scores','occupation_participants','occupation_duels'])
  assert.match(sql,new RegExp('create table if not exists private\\.'+table,'i'));
});

test('OCCUPATION SERVER 02: weekly window is KST Monday bid through Friday 22 and Saturday 22 to 22:30 battle',()=>{
 assert.match(sql,/Asia\/Seoul/);
 assert.match(sql,/interval '4 days 22 hours'/);
 assert.match(sql,/interval '5 days 22 hours'/);
 assert.match(sql,/interval '30 minutes'/);
});

test('OCCUPATION SERVER 03: tickets donate one-for-one into tower-specific permanent merit',()=>{
 assert.match(sql,/donate_occupation_tickets/);
 assert.match(sql,/ticket:'\|\|p_tower\|\|':'\|\|p_floor/);
 assert.match(sql,/balance=private\.occupation_merit\.balance\+excluded\.balance/);
 assert.match(sql,/p_quantity/);
});

test('OCCUPATION SERVER 04: bids are 10 to 100 merit, 30 minute guild cooldown, no cancellation and one tower per cycle',()=>{
 assert.match(sql,/p_amount<10 or p_amount>100/);
 assert.match(sql,/interval '30 minutes'/);
 assert.match(sql,/OCCUPATION_BID_COOLDOWN/);
 assert.match(sql,/unique\(cycle_key,group_key\)/i);
 assert.doesNotMatch(sql,/cancel_occupation_bid/);
});

test('OCCUPATION SERVER 05: highest bid wins ties by first reach and losing bids refund floor 50 percent',()=>{
 assert.match(sql,/order by total_merit desc,first_reached_at asc/);
 assert.match(sql,/floor\(v_bid\.total_merit\*\.5\)/);
 assert.match(sql,/status='WON'/);
 assert.match(sql,/status='LOST'/);
});

test('OCCUPATION SERVER 06: current owner cannot bid and battle creates three fronts',()=>{
 assert.match(sql,/OCCUPATION_OWNER_CANNOT_BID/);
 for(const front of ['LEFT','CENTER','RIGHT'])assert.match(sql,new RegExp("'"+front+"'"));
 assert.match(sql,/occupation_front_scores/);
});

test('OCCUPATION SERVER 07: duel matchmaking is same-front opposite-side strict alternating turn combat',()=>{
 assert.match(sql,/join_occupation_front/);
 assert.match(sql,/front=p_front/);
 assert.match(sql,/side<>v_side/);
 assert.match(sql,/current_actor/);
 assert.match(sql,/OCCUPATION_DUEL_NOT_YOUR_TURN/);
 assert.match(sql,/p_action_nonce<>v_duel\.action_nonce\+1/);
 assert.match(sql,/p_action not in\('BASIC','GUARD'\)/);
});

test('OCCUPATION SERVER 08: final battle result is two of three fronts, with defender retaining tied fronts',()=>{
 assert.match(sql,/attacker_wins>defender_wins/);
 assert.match(sql,/v_attacker_fronts>=2/);
 assert.match(sql,/ATTACKER_WIN/);
 assert.match(sql,/DEFENDER_WIN/);
});

test('OCCUPATION SERVER 09: all public RPCs require active session and authenticated-only execution',()=>{
 for(const name of ['get_occupation_state','donate_occupation_tickets','place_occupation_bid','join_occupation_front','apply_occupation_duel_action']){
  assert.match(sql,new RegExp('create or replace function public\\.'+name+'[\\s\\S]*private\\.require_active_game_session','i'));
  assert.match(sql,new RegExp('revoke all on function public\\.'+name+'[\\s\\S]*public,anon','i'));
  assert.match(sql,new RegExp('grant execute on function public\\.'+name+'[\\s\\S]*authenticated','i'));
 }
});
