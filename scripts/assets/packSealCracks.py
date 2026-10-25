"""Normalize approved crack drawings into a 4x4 atlas. Nearest-neighbor size/anchor correction only.
Usage: python scripts/assets/packSealCracks.py <approved-atlas.png>
"""
from PIL import Image
from pathlib import Path
import sys,json,hashlib
p=Path(sys.argv[1]);raw=p.read_bytes();im=Image.open(p).convert('RGBA')
# The generated rows are not evenly spaced. Explicit cuts prevent neighboring-cell bleed.
ycuts=[0,308,608,909,1254];xcuts=[0,314,627,940,1254]
# Omit two redundant intact cells and order by crack development, not the preview's grid.
order=[0,1,5,3,6,7,9,10,8,11,13,12,14,15]
cell=384;atlas=Image.new('RGBA',(1536,1536));frames=[]
for index,source in enumerate(order):
 c,r=source%4,source//4;rect=(xcuts[c],ycuts[r],xcuts[c+1],ycuts[r+1]);f=im.crop(rect)
 box=f.getchannel('A').point(lambda v:255 if v>96 else 0).getbbox();f=f.crop(box)
 width=round(f.width*292/f.height);f=f.resize((width,292),Image.Resampling.NEAREST)
 x=(cell-width)//2;y=52;atlas.alpha_composite(f,((index%4)*cell+x,(index//4)*cell+y))
 if index==0:
  base=Image.new("RGBA",(cell,cell));base.alpha_composite(f,(x,y))
 frames.append(dict(x=(index%4)*cell,y=(index//4)*cell,anchorX=192,anchorY=154,sourceFrame=source,sourceRect=rect,opaqueBounds=box))
out=Path('public/assets/vfx/summon');atlas.save(out/'seal-stone-cracks-v3.webp',lossless=True,method=6)
meta=dict(width=1536,height=1536,cellSize=384,columns=4,rows=4,anchorX=192,anchorY=154,frames=frames,sourceSha256=hashlib.sha256(raw).hexdigest())
(out/'seal-stone-cracks-v3.json').write_text(json.dumps(meta,indent=2)+'\n')
print((out/'seal-stone-cracks-v3.webp').stat().st_size)

# Extract the original amber inlay as a light mask; this keeps light exactly on the artwork.
mask=Image.new('RGBA',(cell,cell));src=base.load();dst=mask.load()
for y in range(cell):
 for x in range(cell):
  r,g,b,a=src[x,y]
  if r>80 and r>1.8*b and r>1.15*g:
   dst[x,y]=(255,255,255,round(a*min(1,max(0,(r-1.8*b)/65))))
mask.save(out/'seal-rune-mask-v2.webp',lossless=True,method=6)
