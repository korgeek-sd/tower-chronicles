"""Create 24-frame 6x4 atlas from the approved 14-frame seal crack sheet."""
from pathlib import Path
from hashlib import sha256
from PIL import Image, ImageChops, ImageStat
import json

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "public/assets/vfx/summon"
SOURCE = DIR / "seal-stone-cracks-v3.webp"
TARGET = DIR / "seal-stone-cracks-v4-24f.webp"
METADATA = DIR / "seal-stone-cracks-v4-24f.json"
CELL, COLS, ROWS = 384, 6, 4
COUNT = 14

def difference(a, b):
    bg = Image.new("RGBA", a.size, (9, 12, 16, 255))
    fa = Image.alpha_composite(bg, a).convert("RGB")
    fb = Image.alpha_composite(bg, b).convert("RGB")
    return sum(ImageStat.Stat(ImageChops.difference(fa, fb)).mean)

def main():
    with Image.open(SOURCE) as image:
        source = image.convert("RGBA")
    if source.size != (1536, 1536):
        raise ValueError(f"Unexpected atlas dimension: {source.size}")
    originals = [source.crop(((i % 4)*CELL, (i // 4)*CELL,
                              (i % 4+1)*CELL, (i // 4+1)*CELL))
                 for i in range(COUNT)]
    if any(not frame.getchannel("A").getbbox() for frame in originals):
        raise ValueError("Empty source frame")
    scores = [(difference(originals[i], originals[i+1]), i) for i in range(COUNT-1)]
    insert_after = {idx for _, idx in sorted(scores, reverse=True)[:10]}
    frames = []
    for i, frame in enumerate(originals):
        frames.append((frame, i, i, 0.0))
        if i in insert_after:
            frames.append((Image.blend(frame, originals[i+1], 0.5), i, i+1, 0.5))
    assert len(frames) == 24
    atlas = Image.new("RGBA", (COLS*CELL, ROWS*CELL))
    metadata_frames = []
    for index, (frame, a, b, blend) in enumerate(frames):
        x, y = (index % COLS)*CELL, (index // COLS)*CELL
        atlas.alpha_composite(frame, (x, y))
        metadata_frames.append({"index": index, "x": x, "y": y, "width": CELL,
                                "height": CELL, "fromFrame": a,
                                "toFrame": b, "interpolation": blend})
    atlas.save(TARGET, format="WEBP", lossless=True, method=6)
    METADATA.write_text(json.dumps({
        "version": 4, "source": SOURCE.name,
        "sourceSha256": sha256(SOURCE.read_bytes()).hexdigest(),
        "columns": COLS, "rows": ROWS, "cellSize": CELL,
        "width": COLS*CELL, "height": ROWS*CELL,
        "frameCount": 24, "originalFrameCount": COUNT,
        "addedIntermediateFrames": 10, "frames": metadata_frames
    }, indent=2) + "\n", encoding="utf-8")
    with Image.open(TARGET) as check:
        assert check.size == (2304, 1536)
    print(f"Created {TARGET} ({TARGET.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
