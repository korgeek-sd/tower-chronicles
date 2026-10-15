import {useCallback,useEffect,useRef,useState} from 'react';
import './studio0322-splash.css';

const VIDEO_URL=import.meta.env.BASE_URL+'assets/studio0322/splash.mp4';
const MAX_WAIT_MS=5200;

function shouldPlayIntro():boolean {
  if(new URLSearchParams(window.location.search).get('skipSplash')==='1')return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The intro overlays the mounted app, so game/session loading can proceed underneath. */
export function Studio0322Splash(){
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

  if(!visible)return null;
  return (
    <div className="studio0322-splash" role="dialog" aria-modal="true" aria-label="STUDIO 0322 게임 시작 영상">
      <div className="studio0322-splash__stage">
      <video
        className="studio0322-splash__video"
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
      <button className="studio0322-splash__skip" type="button" onClick={finish} aria-label="인트로 건너뛰기">
        건너뛰기
      </button>
      </div>
    </div>
  );
}
