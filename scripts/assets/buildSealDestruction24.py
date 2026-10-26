"""Render a 24-frame destruction atlas using the game's approved cracked seal.

The generated frames are deliberately derived from the actual in-game rune stone
so the opening -> shattering transition never swaps to a different design.
"""
from pathlib import Path
from hashlib import sha256
import json
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "public/assets/vfx/summon"
SOURCE = DIR / "seal-stone-cracks-v4-24f.webp"
DEST = DIR / "seal-stone-destruction-v1-24f.webp"
META = DIR / "seal-stone-destruction-v1-24f.json"
CELL, COLS, ROWS, COUNT = 384, 6, 4, 24
CENTER_X, CENTER_Y = 192, 198
PIECES = 12


def ease_out(t):
    return 1.0 - (1.0 - t) ** 2.4


def frame_at(base, index):
    t = index / (COUNT - 1)
    spread = ease_out(t)
    scene = Image.new("RGBA", (CELL, CELL))
    orig_alpha = base.getchannel("A")

    for part in range(PIECES):
        rng = random.Random(20031 + part * 541)
        angle1 = 2 * math.pi * part / PIECES - math.pi / 2
        angle2 = 2 * math.pi * (part + 1) / PIECES - math.pi / 2
        angle = (angle1 + angle2) / 2
        span = 650
        mask = Image.new("L", (CELL, CELL))
        draw = ImageDraw.Draw(mask)
        draw.polygon([
            (CENTER_X, CENTER_Y),
            (CENTER_X + math.cos(angle1) * span,
             CENTER_Y + math.sin(angle1) * span),
            (CENTER_X + math.cos(angle2) * span,
             CENTER_Y + math.sin(angle2) * span),
        ], fill=255)
        shard = base.copy()
        shard.putalpha(ImageChops.multiply(orig_alpha, mask))
        twist = (part % 2 * 2 - 1) * (12 + part % 4 * 9)
        shard = shard.rotate(twist * spread, Image.Resampling.BICUBIC,
                             center=(CENTER_X, CENTER_Y))
        distance = spread * (26 + rng.randrange(52, 108))
        x = round(math.cos(angle) * distance)
        y = round(math.sin(angle) * distance)
        if t > .66:
            opacity = max(0.0, 1.0 - (t - .66) / .34)
            shard.putalpha(shard.getchannel("A").point(
                lambda value: round(value * opacity)))
        scene.paste(shard, (x, y), shard)

    # Golden radial energy is concentrated at the impact and falls off with
    # the stone debris. Fixed seeds keep frames temporally stable.
    light = Image.new("RGBA", (CELL, CELL))
    glow = ImageDraw.Draw(light, "RGBA")
    intensity = min(1.0, t * 3.5) * max(0.0, 1.0 - max(0.0, t - .37) * 1.45)
    rng = random.Random(71571)
    for p in range(37):
        theta = 2 * math.pi * p / 37 + rng.uniform(-.23, .23)
        length = (14 + 125 * spread) * (.45 + rng.random() * .65)
        dist = 9 + 34 * spread
        sx = CENTER_X + math.cos(theta) * dist
        sy = CENTER_Y + math.sin(theta) * dist
        ex = CENTER_X + math.cos(theta) * length
        ey = CENTER_Y + math.sin(theta) * length
        alpha = round(185 * intensity * (.65 + .35 * math.sin(p * 1.7) ** 2))
        if alpha > 2:
            glow.line((sx, sy, ex, ey), fill=(245, 171, 73, alpha),
                      width=2 if p % 3 else 3)
            glow.ellipse((ex - 2, ey - 2, ex + 2, ey + 2),
                         fill=(255, 211, 115, alpha))

    for p in range(65):
        theta = rng.uniform(-math.pi, math.pi)
        radius = (12 + 175 * spread) * rng.uniform(.22, 1)
        px = CENTER_X + math.cos(theta) * radius
        py = CENTER_Y + math.sin(theta) * radius
        radius_px = 1 if p % 4 else 2
        a = round(230 * max(0.0, 1.0 - max(0.0, t - .67) / .33))
        if a:
            glow.ellipse((px-radius_px, py-radius_px,
                          px+radius_px, py+radius_px),
                         fill=(255, 195, 105, a))
    if intensity > 0:
        cx, cy = CENTER_X, CENTER_Y
        rad = 3 + 23 * intensity
        glow.ellipse((cx-rad, cy-rad, cx+rad, cy+rad),
                     fill=(255, 191, 80, round(165 * intensity)))
    scene = Image.alpha_composite(scene, light)
    return scene


def main():
    with Image.open(SOURCE) as image:
        atlas = image.convert("RGBA")
    assert atlas.size == (2304, 1536)
    base = atlas.crop((5*CELL, 3*CELL, 6*CELL, 4*CELL))
    assert base.getchannel("A").getbbox(), "Source frame must not be empty"
    output = Image.new("RGBA", (COLS*CELL, ROWS*CELL))
    frames = []
    for index in range(COUNT):
        x, y = (index % COLS)*CELL, (index // COLS)*CELL
        output.alpha_composite(frame_at(base, index), (x, y))
        frames.append({"index": index, "x": x, "y": y,
                       "width": CELL, "height": CELL, "pivotX": CENTER_X,
                       "pivotY": CENTER_Y})
    output.save(DEST, "WEBP", lossless=True, method=6)
    META.write_text(json.dumps({
        "version": 1, "source": SOURCE.name,
        "sourceSha256": sha256(SOURCE.read_bytes()).hexdigest(),
        "width": COLS*CELL, "height": ROWS*CELL,
        "columns": COLS, "rows": ROWS, "cellSize": CELL,
        "frameCount": COUNT, "frames": frames
    }, indent=2) + "\n", encoding="utf-8")
    with Image.open(DEST) as result:
        assert result.size == (2304, 1536)
    print("Generated", DEST, DEST.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
