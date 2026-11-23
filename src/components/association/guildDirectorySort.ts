import type {OnlineAssociationDirectoryEntry} from '../../online/association';
export type GuildDirectorySortMode='recent'|'old'|'many'|'few'|'join'|'name'|'powerHigh'|'powerLow';
const isJoinable=(e:OnlineAssociationDirectoryEntry)=>e.joinPolicy!=='CLOSED'&&e.memberCount<e.memberLimit;
export function sortGuilds(a:OnlineAssociationDirectoryEntry,b:OnlineAssociationDirectoryEntry,mode:GuildDirectorySortMode){
 const recent=()=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.name.localeCompare(b.name,'ko-KR');
 switch(mode){
  case 'old':return Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.name.localeCompare(b.name,'ko-KR');
  case 'many':return b.memberCount-a.memberCount||recent();
  case 'few':return a.memberCount-b.memberCount||recent();
  case 'join':return Number(isJoinable(b))-Number(isJoinable(a))||recent();
  case 'name':return a.name.localeCompare(b.name,'ko-KR')||recent();
  case 'powerHigh':return b.combatPower-a.combatPower||recent();
  case 'powerLow':return a.combatPower-b.combatPower||recent();
  default:return recent();
 }
}
