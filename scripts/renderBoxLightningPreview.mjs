// Offline composition of the production chest atlas and FX atlas, using the shared timing.
// This previews the Canvas-compatible sprite path, not a recording of the browser/WebGL mesh.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {boxLightningTime,lightningArtPose} from '../src/components/inventory/boxLightningArt.ts';
import {boxOpeningFrame} from '../src/components/inventory/boxPresentation.ts';
import {encodePNG} from './vendor/pixelfx/tools/lib/png.mjs';
const W=480,H=480,fps=24;
function decode(path,w,h){const r=spawnSync('ffmpeg',['-v','error','-i',path,'-vf',`scale=${w}:${h}:flags=neighbor`,'-f','rawvideo','-pix_fmt','rgba','pipe:1'],{maxBuffer:32e6});if(r.status)throw Error(r.stderr.toString());return r.stdout;}
const chest=decode('public/assets/ui/shop/adventurer_box_opening_v4.png',1344,128);
const fx=decode('public/assets/ui/shop/box_lightning_pixelfx_v4.png',1344,1344);
const bg=decode('public/assets/backgrounds/summon/summon-altar-v1.webp',480,480);
function stamp(out,src,sw,sx,sy,cw,ch,dx,dy,scale){
 for(let y=Math.max(0,Math.ceil(dy));y<Math.min(H,dy+ch*scale);y++)for(let x=Math.max(0,Math.ceil(dx));x<Math.min(W,dx+cw*scale);x++){
  const si=((sy+Math.floor((y-dy)/scale))*sw+sx+Math.floor((x-dx)/scale))*4,di=(y*W+x)*4,a=src[si+3]/255;
  for(let c=0;c<3;c++)out[di+c]=Math.round(src[si+c]*a+out[di+c]*(1-a));
 }
}
const frames=[],contact=new Uint8Array(480*480*4*6),times=[.9,1.8,2.36,2.6,2.82,3.4];
function frame(t){
 const out=Buffer.from(bg);for(let i=0;i<out.length;i+=4){for(let c=0;c<3;c++)out[i+c]*=.38;out[i+3]=255;}
 const burst=2.32,hold=1.92,charge=.65;
 const drop=t<.38?-136*(1-Math.pow(t/.38,4)):0;
 const rootY=249+drop*4/3,scale=2.15*4/3;
 const ci=boxOpeningFrame(Math.max(0,t-burst)*1000);
 stamp(out,chest,1344,ci*112,0,112,128,240-56*scale,rootY-80*scale,scale);
 const pose=lightningArtPose(boxLightningTime(t,charge,hold,burst));
 if(pose)stamp(out,fx,1344,pose.frame%7*192,Math.floor(pose.frame/7)*192,192,192,240-8*4/3-96*8/3,rootY-12*4/3-140*8/3,8/3);
 return out;
}
for(let i=0;i<Math.round(4.2*fps);i++)frames.push(frame(Math.min(i/fps,3.8)));
for(let n=0;n<times.length;n++){const f=frame(times[n]);for(let y=0;y<480;y++)contact.set(f.subarray(y*480*4,(y+1)*480*4),((Math.floor(n/3)*480+y)*1440+n%3*480)*4);}
mkdirSync('/tmp/chest-v4-review',{recursive:true});
writeFileSync('/tmp/chest-v4-review/contact.png',encodePNG(1440,960,contact));
writeFileSync('public/assets/previews/box-opening-v4.png',encodePNG(W,H,frame(2.6)));
const r=spawnSync('ffmpeg',['-y','-v','error','-f','rawvideo','-pixel_format','rgba','-video_size','480x480','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','public/assets/previews/box-opening-v4.mp4'],{input:Buffer.concat(frames),maxBuffer:32e6});if(r.status)throw Error(r.stderr.toString());
console.log('Rendered 4.2s production-atlas preview and six-stage contact sheet.');
