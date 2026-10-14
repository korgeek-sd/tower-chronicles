import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {AssociationWarehousePanel} from '../src/components/association/AssociationWarehousePanel';

const migration=readFileSync(new URL('../supabase/migrations/20261014075339_association_shared_warehouse.sql',import.meta.url),'utf8');
test('treasury is private, uses authenticated lease-gated RPC and keeps its own idempotent receipts',()=>{
 assert.match(migration,/treasury_gold bigint not null default 0/);
 assert.match(migration,/treasury_tickets bigint not null default 0/);
 assert.match(migration,/alter table private\.association_warehouse_ledger enable row level security/);
 assert.match(migration,/alter table private\.association_warehouse_receipts enable row level security/);
 assert.match(migration,/private\.require_active_game_session/);
 assert.match(migration,/WAREHOUSE_REQUEST_CONFLICT/);
 assert.match(migration,/grant execute on function public\.deposit_association_warehouse/);
 assert.match(migration,/revoke all on function private\.association_warehouse_json/);
 assert.match(migration,/WAREHOUSE_DURING_EXPEDITION/);
});
test('warehouse donations debit authoritative personal inventory before crediting the guild',()=>{
 assert.match(migration,/update private\.player_wallets/);
 assert.match(migration,/update private\.village_life_players/);
 assert.match(migration,/treasury_silver=treasury_silver\+/);
 assert.match(migration,/treasury_gold=treasury_gold\+/);
 assert.match(migration,/treasury_tickets=treasury_tickets\+/);
 assert.match(migration,/private\.persist_server_association_to_save/);
 assert.match(migration,/private\.broadcast_association_change/);
});
test('declaring war consumes guild tickets rather than leader tickets and records the expense',()=>{
 const declaration=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.declare_village_war'));
 assert.match(declaration,/treasury_tickets=treasury_tickets-100/);
 assert.match(declaration,/WAR_GUILD_TICKETS_SHORT/);
 assert.match(declaration,/WAR_DECLARATION/);
 assert.doesNotMatch(declaration,/update private\.village_life_players/);
 assert.match(migration,/'guildTickets'/);
});
test('treasury UI is read-only; headquarters donations award contribution and fill shared storage',()=>{
 const lease:any={leaseId:'test',generation:1,clientInstanceId:'client'};
 const html=renderToStaticMarkup(React.createElement(AssociationWarehousePanel,{lease,associationId:'guild'}));
 assert.match(html,/원정단 금고/);
 assert.match(html,/불러오는 중/);
 const source=readFileSync(new URL('../src/components/association/AssociationWarehousePanel.tsx',import.meta.url),'utf8');
 for(const value of ['공용 실버','공용 골드','공용 도전권'])assert.match(source,new RegExp(value));
 assert.match(source,/사냥 수익 분담/);
 assert.doesNotMatch(source,/depositAssociationWarehouse|기부하기/);
 const supply=readFileSync(new URL('../src/components/association/AssociationSupplyPanel.tsx',import.meta.url),'utf8');
 assert.match(supply,/도전권 기부/);
 assert.match(supply,/공용 금고 적립/);
 const entry=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
 assert.match(entry,/\['warehouse','금고'\]/);
});
