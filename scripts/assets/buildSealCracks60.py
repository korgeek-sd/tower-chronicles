"""Rebuild a 60-frame 10x6 cracking atlas from the approved game 24-frame art.

The new atlas preserves the exact first and last frames. Intermediates are
temporally sampled from successive approved frames, rather than inventing a
new stone silhouette. Keep the destruction effect on its existing 24 frames.
"""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "public/assets/vfx/summon"
SOURCE = DIR / "seal-stone-cracks-v4-24f.webp"
TARGET = DIR / "seal-stone-cracks-v5-60f.webp"
META = DIR / "seal-stone-cracks-v5-60f.json"
COLS, ROWS, CELL = 10, 6, 256
OLD_COLS, OLD_ROWS, OLD_CELL = 6, 4, 384
COUNT, OLD_COUNT = 60, 24

def main():
    with Image.open(SOURCE) as im:
        source = im.convert("RGBA")
    assert source.size == (OLD_COLS*OLD_CELL, OLD_ROWS*OLD_CELL)
    originals = [
        source.crop(((i%OLD_COLS)*OLD_CELL, (i//OLD_COLS)*OLD_CELL,
                     (i%OLD_COLS+1)*OLD_CELL, (i//OLD_COLS+1)*OLD_CELL)).resize(
                         (CELL, CELL), Image.Resampling.LANCZOS)
        for i in range(OLD_COUNT)
    ]
    atlas = Image.new("RGBA", (COLS*CELL, ROWS*CELL))
    frames = []
    for i in range(COUNT):
        pos = (OLD_COUNT-1)*i/(COUNT-1)
        lo = int(pos)
        hi = min(lo+1,OLD_COUNT-1)
        blend = pos-lo
        tile = Image.blend(originals[lo], originals[hi], blend)
        x,y = (i%COLS)*CELL,(i//COLS)*CELL
        atlas.alpha_composite(tile,(x,y))
        frames.append({"index":i,"x":x,"y":y,"width":CELL,"height":CELL,
                       "fromFrame":lo,"toFrame":hi,"blend":round(blend,6)})
    atlas.save(TARGET, format="WEBP", lossless=True, method=6)
    META.write_text(json.dumps({
        "version":5,"source":SOURCE.name,
        "sourceSha256":sha256(SOURCE.read_bytes()).hexdigest(),
        "width":COLS*CELL,"height":ROWS*CELL,"columns":COLS,"rows":ROWS,
        "cellSize":CELL,"frameCount":COUNT,"frames":frames
    }, indent=2)+"\n",encoding="utf-8")
    with Image.open(TARGET) as check:
        assert check.size==(2560,1536)
        assert check.mode=="RGBA"
    print("Built",TARGET,TARGET.stat().st_size,"bytes")

if __name__=="__main__":
    main()
