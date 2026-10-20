// This catalog describes deployable worlds, not channels sharing one save database.
// Enable another entry only after its backend routing and data isolation are implemented.
export const GAME_SERVERS:readonly {id:string;name:string}[]=[{id:'main',name:'1서버'}];
export const SERVER_PREFERENCE_KEY='tc-preferred-server-v1';
export function resolveServer(id:string|null){return GAME_SERVERS.find(server=>server.id===id)??GAME_SERVERS[0];}
export function loadPreferredServer(storage:Pick<Storage,'getItem'>){try{return resolveServer(storage.getItem(SERVER_PREFERENCE_KEY));}catch{return GAME_SERVERS[0];}}
export function savePreferredServer(id:string,storage:Pick<Storage,'setItem'>){try{storage.setItem(SERVER_PREFERENCE_KEY,resolveServer(id).id);}catch{/* UI preference must never prevent entry. */}}
export function canEnterGame(signedIn:boolean,entered:boolean){return signedIn&&entered;}
