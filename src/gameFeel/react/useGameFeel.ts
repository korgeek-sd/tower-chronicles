import {useContext} from 'react';
import {GameFeelContext,type GameFeelApi} from './GameFeelProvider';

export const noopGameFeel:GameFeelApi={play:()=>{}};

export function useGameFeel():GameFeelApi{
 return useContext(GameFeelContext)??noopGameFeel;
}
