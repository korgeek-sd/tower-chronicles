import {useEffect,useState} from 'react';

function currentViewportHeight(){
  if(typeof window==='undefined')return 844;
  return Math.round(window.visualViewport?.height??window.innerHeight);
}

export function useViewportHeight(){
  const [height,setHeight]=useState(currentViewportHeight);

  useEffect(()=>{
    const update=()=>setHeight(currentViewportHeight());

    window.addEventListener('resize',update);
    window.visualViewport?.addEventListener('resize',update);

    return()=>{
      window.removeEventListener('resize',update);
      window.visualViewport?.removeEventListener('resize',update);
    };
  },[]);

  return height;
}
