"""Pack the approved atlas without redrawing or rescaling its artwork.
Usage: python scripts/assets/packSealFrames.py <original-atlas.png>
Only frame extraction, transparent padding and integer anchor translations are used.
"""
from pathlib import Path
import sys,json,hashlib
from PIL import Image
source=Path(sys.argv[1]);raw=source.read_bytes();image=Image.open(source).convert('RGBA')
# Diamond/core centers measured in each original cell. Keep the same visual pivot.
anchors=[(172,118),(158,118),(152,118),(150,118),(170,112),(156,112),(150,112),(148,112),(171,116),(156,116),(153,123),(151,123),(171,124),(156,124),(154,124),(152,124)]
cell=384;anchor=(192,154);atlas=Image.new('RGBA',(cell*4,cell*4));frames=[]
for i,(ax,ay) in enumerate(anchors):
 col,row=i%4,i//4
 rect=[round(col*image.width/4),round(row*image.height/4),round((col+1)*image.width/4),round((row+1)*image.height/4)]
 frame=image.crop(rect);dx,dy=anchor[0]-ax,anchor[1]-ay
 canvas=Image.new('RGBA',(cell,cell));canvas.alpha_composite(frame,(dx,dy));atlas.alpha_composite(canvas,(col*cell,row*cell))
 frames.append(dict(x=col*cell,y=row*cell,anchorX=anchor[0],anchorY=anchor[1],sourceRect=rect,offsetX=dx,offsetY=dy))
out=Path('public/assets/vfx/summon');out.mkdir(parents=True,exist_ok=True)
atlas.save(out/'seal-stone-16frames-v2.webp',lossless=True,method=6)
meta=dict(width=cell*4,height=cell*4,cellSize=cell,columns=4,rows=4,anchorX=anchor[0],anchorY=anchor[1],sourceSha256=hashlib.sha256(raw).hexdigest(),sourceSize=list(image.size),frames=frames)
(out/'seal-stone-16frames-v2.json').write_text(json.dumps(meta,indent=2)+'\n')
print('Packed',atlas.size,(out/'seal-stone-16frames-v2.webp').stat().st_size,'bytes')
