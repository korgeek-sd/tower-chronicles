import {BOX_LIGHTNING_STYLES} from '../src/components/inventory/boxLightningArt.ts';
import {loadEffect,renderFrames,spriteSheet,save,contactSheet} from './vendor/pixelfx/tools/lib/fxlib.mjs';
const fx=await loadEffect('lightning/chest-release');
for(const [grade,style] of Object.entries(BOX_LIGHTNING_STYLES)){
 const r=renderFrames(fx,{options:{palette:style.palette}});
 const s=spriteSheet(fx,r,'chest-release');
 save(`public/assets/ui/shop/box_lightning_v5_${grade}.png`,s.png);
 save(`/tmp/chest-v5/${grade}.png`,contactSheet(fx,r,{max:12,zoom:1}));
 console.log(grade,r.n,'frames');
}
