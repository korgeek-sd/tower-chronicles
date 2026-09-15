import type {Cosmetics,GameState} from '../types';
import {appearanceById,COSMETICS_CATALOG,DEFAULT_APPEARANCE_ID,titleById,type CosmeticsCatalog} from '../data/cosmetics';
export const initialCosmetics=():Cosmetics=>({unlockedAppearanceIds:[DEFAULT_APPEARANCE_ID],selectedAppearanceId:DEFAULT_APPEARANCE_ID,appearanceItems:{},unlockedTitleIds:[],selectedTitleId:null});
export function registerAppearance(s:GameState,id:string,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {
 const n=structuredClone(s),appearance=appearanceById(id,catalog);
 if(!appearance)return {...n,notice:'등록할 수 없는 외형입니다.'};
 if(n.cosmetics.unlockedAppearanceIds.includes(id))return {...n,notice:'이미 등록된 외형입니다.'};
 if(!Number.isSafeInteger(n.cosmetics.appearanceItems[id])||n.cosmetics.appearanceItems[id]<1)return {...n,notice:'보유한 외형 아이템이 없습니다.'};
 n.cosmetics.appearanceItems[id]--;n.cosmetics.unlockedAppearanceIds.push(id);n.notice=appearance.name+' 외형을 영구 등록했습니다.';return n;
}
export function selectAppearance(s:GameState,id:string,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {
 const n=structuredClone(s);if(n.expedition)return {...n,notice:'원정 중에는 외형을 변경할 수 없습니다.'};
 if(!appearanceById(id,catalog)||!n.cosmetics.unlockedAppearanceIds.includes(id))return {...n,notice:'해금되지 않은 외형입니다.'};
 n.cosmetics.selectedAppearanceId=id;n.notice=appearanceById(id,catalog)!.name+' 외형을 적용했습니다.';return n;
}
export function selectTitle(s:GameState,id:string|null,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {
 const n=structuredClone(s);if(n.expedition)return {...n,notice:'원정 중에는 칭호를 변경할 수 없습니다.'};
 if(id!==null&&(!titleById(id,catalog)||!n.cosmetics.unlockedTitleIds.includes(id)))return {...n,notice:'보유하지 않은 칭호입니다.'};
 n.cosmetics.selectedTitleId=id;n.notice=id?('「'+titleById(id,catalog)!.name+'」 칭호를 적용했습니다.'):'칭호를 해제했습니다.';return n;
}

