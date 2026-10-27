import {useEffect} from 'react';
import {mountBackgroundMusic} from '../audio/backgroundMusic';
/** One lifetime per root — does not remount on page changes. */
export function BackgroundMusic(){
 useEffect(()=>mountBackgroundMusic(),[]);
 return null;
}
