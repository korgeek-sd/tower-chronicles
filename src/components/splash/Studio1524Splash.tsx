import {useCallback,useEffect,useRef,useState} from 'react';
import './studio1524-splash.css';

const VIDEO_URL=import.meta.env.BASE_URL+'assets/studio1524/splash.mp4?v=studio1524-20261022-1';
// The selected cinematic lasts six seconds; allow loading time before the failsafe.
const MAX_WAIT_MS=10000;

function shouldPlayIntro():boolean {
  if(new URLSearchParams(window.location.search).get('skipSplash')==='1')return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The intro overlays the mounted app, so game/session loading can proceed underneath. */
export function Studio1524Splash({onComplete}:{onComplete?:()=>void}={}){
  const [visible,setVisible]=useState(shouldPlayIntro);
  const finished=useRef(false);
  const finish=useCallback(()=>{
    if(finished.current)return;
    finished.current=true;
    setVisible(false);
  },[]);

  useEffect(()=>{
    if(!visible)return;
    // A missing, stalled or blocked video must never lock the player out.
    const timer=window.setTimeout(finish,MAX_WAIT_MS);
    return()=>window.clearTimeout(timer);
  },[finish,visible]);

  useEffect(()=>{if(!visible)onComplete?.();},[visible,onComplete]);

  if(!visible)return null;
  return (
    <div className="studio1524-splash" role="dialog" aria-modal="true" aria-label="STUDIO 1524 게임 시작 영상">
      <div className="studio1524-splash__stage">
      <video
        className="studio1524-splash__video"
        src={VIDEO_URL}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        onEnded={finish}
        onError={finish}
      />
      </div>
    </div>
  );
}

