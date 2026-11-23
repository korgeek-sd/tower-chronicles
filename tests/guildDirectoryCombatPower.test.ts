import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {OnlineAssociationDirectoryEntry} from '../src/online/association.ts';
import {sortGuilds} from '../src/components/association/guildDirectorySort.ts';
const mk=(name:string,combatPower:number,createdAt='2026-11-01T00:00:00.000Z'):OnlineAssociationDirectoryEntry=>({
 associationId:name,recordNumber:'00001',name,description:'',joinPolicy:'OPEN',
 memberCount:2,memberLimit:30,combatPower,createdAt,revenueShareRatePercent:0
});
test('원정단 검색: 전투력 높은 순과 낮은 순으로 정렬',()=>{
 const rows=[mk('가',1200),mk('나',4000),mk('다',2800)];
 assert.deepEqual([...rows].sort((a,b)=>sortGuilds(a,b,'powerHigh')).map(x=>x.name),['나','다','가']);
 assert.deepEqual([...rows].sort((a,b)=>sortGuilds(a,b,'powerLow')).map(x=>x.name),['가','다','나']);
});
test('동점이면 생성일로 정렬하고 기존 최근 창설순 기본 정렬 유지',()=>{
 const old=mk('오래',5000,'2026-10-01T00:00:00.000Z'),recent=mk('최신',5000,'2026-11-01T00:00:00.000Z');
 assert.ok(sortGuilds(old,recent,'powerHigh')>0);
 assert.ok(sortGuilds(old,recent,'recent')>0);
});
test('목록과 상세에 동일한 전투력을 표시하고 정렬 옵션을 노출',()=>{
 const screen=readFileSync(new URL('../src/components/association/GuildRecruitmentBoard.tsx',import.meta.url),'utf8');
 assert.match(screen,/전투력 높은 순/);assert.match(screen,/전투력 낮은 순/);
 assert.match(screen,/e\.combatPower\.toLocaleString/);assert.match(screen,/원정단 총 전투력/);
 const mock=readFileSync(new URL('../src/guildLab/mockBackend.ts',import.meta.url),'utf8');
 assert.match(mock,/combatPower:d\.combatPower/);
});
