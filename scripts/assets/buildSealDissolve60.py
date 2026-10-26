"""Generate a 60-frame disintegrating summon seal, not a split-open or blast effect.

The source is the last fully charged frame of the live 60-frame crack atlas.
The first frame therefore matches the existing in-game stone exactly. Stone
tiles progressively crumble into small rubble, embers and thin glowing dust.
"""
from pathlib import Path
from hashlib import sha256
from PIL import Image, ImageDraw
import json
import math
import random

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public/assets/vfx/summon"
SOURCE = OUT_DIR / "seal-stone-cracks-v5-60f.webp"
TARGET = OUT_DIR / "seal-stone-dissolve-v1-60f.webp"
META = OUT_DIR / "seal-stone-dissolve-v1-60f.json"
COLS, ROWS, CELL, COUNT = 10, 6, 256, 60
CENTER = (128, 123)

def smooth(x):
    x=max(0.0,min(1.0,x))
    return x*x*(3-2*x)

def build_chunks(base):
    chunks=[]
    box=base.getchannel("A").getbbox()
    if not box: raise ValueError("The live crack atlas has an empty ending frame.")
    for y in range(box[1],box[3],9):
        for x in range(box[0],box[2],9):
            img=base.crop((x,y,min(x+9,CELL),min(y+9,CELL)))
            if img.getchannel("A").getbbox() is None: continue
            rng=random.Random(x*17389+y*7819+1117)
            cx=x+img.width/2
            cy=y+img.height/2
            radial=min(1, math.hypot((cx-CENTER[0])/68,(cy-CENTER[1])/110))
            # Exterior flakes first; preserve a recognizable glowing core until
            # halfway through the crumble animation.
            threshold=(0.27+0.36*(1-radial))+rng.random()*0.29
            angle=math.atan2(cy-CENTER[1],cx-CENTER[0])+rng.uniform(-.75,.75)
            speed=25+rng.uniform(4,52)
            chunks.append((img,x,y,threshold,angle,speed,rng.random()))
    return chunks

def render(base, chunks, n):
    t=n/(COUNT-1)
    out=Image.new("RGBA",(CELL,CELL))
    if n==0:return base.copy()
    # The old opening begins at its final cracked pose. No additional pause.
    for tile,x,y,threshold,angle,speed,phase in chunks:
        if t<0.08: amount=0
        else: amount=smooth((t-.08)/.84)
        # Block lifetime does not flicker: pieces only get smaller/dimmer.
        erosion=max(0.0,(amount-threshold)/.23)
        if erosion>=1:continue
        alpha_mul=1-smooth(erosion)
        movement=smooth(max(0,(amount-threshold+.11)/.38))
        dx=round(math.cos(angle)*speed*movement)
        dy=round(math.sin(angle)*speed*movement+14*movement**2)
        part=tile.copy()
        if movement>.1:
            scale=max(.28,1-.65*movement)
            tw=max(1,round(tile.width*scale))
            th=max(1,round(tile.height*scale))
            part=tile.resize((tw,th),Image.Resampling.BICUBIC)
        if alpha_mul<1:
            part.putalpha(part.getchannel("A").point(lambda v:int(v*alpha_mul)))
        xx=x+dx+(tile.width-part.width)//2
        yy=y+dy+(tile.height-part.height)//2
        out.alpha_composite(part,(xx,yy))
    # Dissolving sand and sparks: independently seeded, deterministic across all
    # frames, with a taper toward fully transparent on the final frame.
    if t>.12 and t<1:
        d=ImageDraw.Draw(out,"RGBA")
        rng=random.Random(15724)
        activation=smooth((t-.12)/.34)
        fade=1-smooth(max(0,(t-.64)/.36))
        for j in range(82):
            theta=rng.uniform(-math.pi,math.pi)
            radius=rng.uniform(18,109)
            onset=rng.uniform(.1,.76)
            if t<onset:continue
            travel=smooth((t-onset)/max(.01,1-onset))
            r=8+radius*travel
            xx=CENTER[0]+math.cos(theta)*r
            yy=CENTER[1]+math.sin(theta)*r+26*travel
            alpha=int((75+int(rng.random()*155))*activation*fade*(1-travel*.42))
            if alpha<=0:continue
            rad=1+(j%15==0)
            tone=(247,171,80,alpha) if j%3 else (61,69,77,alpha)
            d.ellipse((xx-rad,yy-rad,xx+rad,yy+rad),fill=tone)
    if n==COUNT-1:
        return Image.new("RGBA",(CELL,CELL))
    return out

def main():
    with Image.open(SOURCE) as im: src=im.convert("RGBA")
    if src.size!=(2560,1536):raise ValueError(f"Unexpected source size: {src.size}")
    base=src.crop((9*CELL,5*CELL,10*CELL,6*CELL))
    chunks=build_chunks(base)
    atlas=Image.new("RGBA",(COLS*CELL,ROWS*CELL))
    frames=[]
    for i in range(COUNT):
        x=(i%COLS)*CELL;y=(i//COLS)*CELL
        atlas.alpha_composite(render(base,chunks,i),(x,y))
        frames.append({"index":i,"x":x,"y":y,"width":CELL,"height":CELL,
                       "pivotX":CENTER[0],"pivotY":CENTER[1]})
    atlas.save(TARGET,"WEBP",lossless=True,method=6)
    META.write_text(json.dumps({
        "version":1,"source":SOURCE.name,
        "sourceSha256":sha256(SOURCE.read_bytes()).hexdigest(),
        "effect":"crumble_dissolve","columns":COLS,"rows":ROWS,
        "cellSize":CELL,"width":COLS*CELL,"height":ROWS*CELL,
        "frameCount":COUNT,"frames":frames
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    with Image.open(TARGET) as im:
        assert im.size==(2560,1536)
        assert im.mode=="RGBA"
        assert im.crop((0,0,CELL,CELL)).getchannel("A").getbbox()
        assert im.crop((9*CELL,5*CELL,10*CELL,6*CELL)).getchannel("A").getbbox() is None
    print("Created",TARGET,TARGET.stat().st_size,"bytes")

if __name__=="__main__":main()
