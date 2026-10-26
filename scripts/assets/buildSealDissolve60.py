"""Generate a seamless 60-frame summon-seal crumble effect from approved artwork.

The seal is partitioned with *warped Voronoi* masks rather than rectangular
image tiles. Each irregular stone chip pulls away from the outside inward;
independently seeded fractal noise erodes the pieces and leaves fine dust.
The first frame exactly matches the completed crack sequence and the final
frame is fully transparent. The generator is deterministic and uses Pillow only.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
import json
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "public/assets/vfx/summon"
SOURCE = ASSETS / "seal-stone-cracks-v5-60f.webp"
TARGET = ASSETS / "seal-stone-dissolve-v2-60f.webp"
META = ASSETS / "seal-stone-dissolve-v2-60f.json"
COLS, ROWS, CELL, COUNT = 10, 6, 256, 60
CENTER = (128, 123)
SEED = 152406


def clamp(v: float) -> float:
    return max(0., min(1., v))


def smooth(v: float) -> float:
    x = clamp(v)
    return x * x * (3 - 2 * x)


def field(size: tuple[int, int], grain: int, seed: int) -> Image.Image:
    """Deterministic, smooth 0–255-valued spatial noise."""
    rng = random.Random(seed)
    w, h = size
    low = Image.new("L", (max(3, math.ceil(w / grain)), max(3, math.ceil(h / grain))))
    low.putdata([rng.randrange(256) for _ in range(low.width * low.height)])
    return low.resize(size, Image.Resampling.BICUBIC)


@dataclass
class Chip:
    image: Image.Image
    rough: Image.Image
    x: int
    y: int
    cx: float
    cy: float
    start: float
    duration: float
    angle: float
    distance: float
    spin: float


def build_chips(base: Image.Image) -> list[Chip]:
    """Assign every stone pixel to exactly one warped, irregular Voronoi chip."""
    bbox = base.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("The finished crack sprite has no opaque pixels")
    left, top, right, bottom = bbox
    mask_alpha = base.getchannel("A")
    px = mask_alpha.load()
    rng = random.Random(SEED)

    # Mix broad rock plates with small flakes. Weighted Voronoi permits both
    # scales while avoiding axis-aligned edges and checkerboard seams.
    seeds: list[tuple[int,int,float]] = []
    for _ in range(5000):
        if len(seeds) >= 58:
            break
        x = rng.randrange(left, right)
        y = rng.randrange(top, bottom)
        if px[x, y] < 100:
            continue
        separation = 7 if len(seeds) % 4 else 12
        if any((x - sx) ** 2 + (y - sy) ** 2 < separation**2
               for sx, sy, _ in seeds):
            continue
        bias = rng.uniform(-28, 45) if len(seeds) % 7 else rng.uniform(-110, -42)
        seeds.append((x, y, bias))
    if len(seeds) < 28:
        raise ValueError(f"Too few internal fracture seeds ({len(seeds)})")

    # Warp the sampling coordinates by continuous fields; never use a regular
    # grid to decide which pixels belong to a fragment.
    x_warp = field((CELL, CELL), 17, SEED + 1).load()
    y_warp = field((CELL, CELL), 21, SEED + 2).load()
    ownership: list[Image.Image] = [Image.new("L", (CELL, CELL)) for _ in seeds]
    cells = [m.load() for m in ownership]
    for y in range(top, bottom):
        for x in range(left, right):
            if px[x, y] == 0:
                continue
            wx = x + (x_warp[x, y] - 128) / 20.
            wy = y + (y_warp[x, y] - 128) / 20.
            best = 0
            lowest = float("inf")
            for j, (sx, sy, bias) in enumerate(seeds):
                d = (wx - sx) ** 2 + (wy - sy) ** 2 + bias
                if d < lowest:
                    lowest, best = d, j
            cells[best][x, y] = 255

    cloud_a = field((CELL, CELL), 10, SEED + 3)
    cloud_b = field((CELL, CELL), 4, SEED + 4)
    chips: list[Chip] = []
    for j, mask in enumerate(ownership):
        b = mask.getbbox()
        if b is None:
            continue
        part = base.crop(b)
        original_alpha = part.getchannel("A")
        cut = mask.crop(b)
        part.putalpha(ImageChops.multiply(original_alpha, cut))
        if part.getchannel("A").getbbox() is None:
            continue
        w, h = part.size
        cp = cut.load()
        n1 = cloud_a.crop(b).load()
        n2 = cloud_b.crop(b).load()
        interior = cut.filter(ImageFilter.GaussianBlur(2.2)).load()
        rough = Image.new("L", (w, h))
        rp = rough.load()
        for yy in range(h):
            for xx in range(w):
                if cp[xx, yy] == 0:
                    continue
                # Erosion threshold is never constant across a square crop.
                # Edges and fine protrusions weather earlier than solid rock.
                n = .62 * n1[xx, yy] + .38 * n2[xx, yy]
                strength = 0.07 + .72 * n / 255 + .18 * interior[xx, yy] / 255
                rp[xx, yy] = round(255 * min(1., strength))
        x, y = b[:2]
        sx, sy, _ = seeds[j]
        cx, cy = sx, sy
        radial = clamp(math.hypot((cx - CENTER[0]) / 57, (cy - CENTER[1]) / 92))
        random_chip = random.Random(SEED + 43*j)
        # Exterior fragments loosen first; the central rune holds longest.
        start = .075 + .43 * (1 - radial) + random_chip.uniform(-.035,.052)
        duration = random_chip.uniform(.25,.38)
        angle = math.atan2(cy - CENTER[1], cx - CENTER[0])
        angle += random_chip.uniform(-.75,.75)
        size = math.sqrt(w*h)
        distance = random_chip.uniform(16,40) * (1.1 if size<18 else .72)
        spin = random_chip.uniform(-19,19) * (1.2 if size<15 else .75)
        chips.append(Chip(part, rough, x, y, cx, cy, start, duration,
                          angle, distance, spin))
    if len(chips) < 25:
        raise ValueError("Fracture masks collapsed unexpectedly")
    return chips


def transform_chip(chip: Chip, t: float) -> tuple[Image.Image, int, int] | None:
    if t < chip.start:
        return chip.image, chip.x, chip.y
    age = clamp((t - chip.start) / chip.duration)
    if age >= 1:
        return None
    # Rough translucent borders emerge from the source alpha itself; the
    # interior erodes nonuniformly rather than shrinking into small rectangles.
    retained = chip.rough.point(
        lambda v: round(255*smooth((v/255. - age)/.115)))
    alpha = ImageChops.multiply(chip.image.getchannel("A"), retained)
    if alpha.getbbox() is None:
        return None
    piece = chip.image.copy()
    piece.putalpha(alpha)
    travel = smooth((t-chip.start)/(.32+chip.duration*.12))
    twist = chip.spin * travel
    if abs(twist) > .2:
        piece = piece.rotate(twist, Image.Resampling.BICUBIC, expand=True)
    offx = round(math.cos(chip.angle)*chip.distance*travel)
    offy = round(math.sin(chip.angle)*chip.distance*travel + 15*travel*travel)
    return (piece, chip.x + offx - (piece.width-chip.image.width)//2,
            chip.y + offy - (piece.height-chip.image.height)//2)


def dust_particles(base: Image.Image) -> list[tuple[float,...]]:
    rng=random.Random(SEED+310)
    solid=base.getchannel("A").load()
    particles=[]
    for _ in range(125):
        for _ in range(60):
            x=rng.randint(76,180);y=rng.randint(19,221)
            if solid[x,y] > 135:
                break
        else:
            continue
        radial=clamp(math.hypot((x-CENTER[0])/57,(y-CENTER[1])/92))
        start=.13+.39*(1-radial)+rng.uniform(-.04,.07)
        angle=math.atan2(y-CENTER[1],x-CENTER[0])+rng.uniform(-1.1,1.1)
        particles.append((x,y,start,angle,rng.uniform(17,52),rng.uniform(.25,.46),rng.randrange(3)))
    return particles


def render(base: Image.Image, chips: list[Chip], particles: list[tuple[float,...]], n: int) -> Image.Image:
    if n == 0:
        return base.copy()
    if n == COUNT - 1:
        return Image.new("RGBA",(CELL,CELL))
    t=n/(COUNT-1)
    canvas=Image.new("RGBA",(CELL,CELL))
    for chip in chips:
        result=transform_chip(chip,t)
        if result is not None:
            img,x,y=result
            canvas.alpha_composite(img,(x,y))
    d=ImageDraw.Draw(canvas,"RGBA")
    for x,y,start,angle,speed,duration,kind in particles:
        if t<start:
            continue
        phase=clamp((t-start)/duration)
        if phase>=1:
            continue
        velocity=smooth(phase)
        px=x+math.cos(angle)*speed*velocity
        py=y+math.sin(angle)*speed*velocity - 10*velocity + 20*velocity*velocity
        fade=smooth(min(phase/.25,(1-phase)/.55))
        opacity=round(185*fade)
        color=((217,164,95,opacity) if kind==0 else
               (92,97,99,opacity) if kind==1 else
               (245,198,119,opacity))
        radius=1 if kind else 2
        d.ellipse((px-radius,py-radius,px+radius,py+radius),fill=color)
    return canvas


def main() -> None:
    with Image.open(SOURCE) as im:
        atlas=im.convert("RGBA")
    if atlas.size!=(2560,1536):
        raise ValueError(f"Unexpected source atlas size {atlas.size}")
    base=atlas.crop((9*CELL,5*CELL,10*CELL,6*CELL))
    chips=build_chips(base)
    particles=dust_particles(base)
    output=Image.new("RGBA",(COLS*CELL,ROWS*CELL))
    frames=[]
    for i in range(COUNT):
        x=(i%COLS)*CELL;y=(i//COLS)*CELL
        output.alpha_composite(render(base,chips,particles,i),(x,y))
        frames.append({"index":i,"x":x,"y":y,"width":CELL,"height":CELL,
                       "pivotX":CENTER[0],"pivotY":CENTER[1]})
    output.save(TARGET,format="WEBP",lossless=True,method=6)
    META.write_text(json.dumps({
        "version":2,"source":SOURCE.name,
        "sourceSha256":sha256(SOURCE.read_bytes()).hexdigest(),
        "effect":"irregular_noise_dissolve","partition":"warped_voronoi",
        "chipCount":len(chips),"particleCount":len(particles),
        "columns":COLS,"rows":ROWS,"cellSize":CELL,"frameCount":COUNT,
        "width":COLS*CELL,"height":ROWS*CELL,"frames":frames
    },indent=2)+"\n",encoding="utf-8")
    with Image.open(TARGET) as check:
        assert check.mode=="RGBA" and check.size==(2560,1536)
        assert ImageChops.difference(check.crop((0,0,CELL,CELL)).getchannel("A"),base.getchannel("A")).getbbox() is None
        assert check.crop((9*CELL,5*CELL,10*CELL,6*CELL)).getchannel("A").getbbox() is None
    print(f"Generated {len(chips)} irregular chips, {len(particles)} dust particles; {TARGET.stat().st_size} bytes")

if __name__=="__main__":
    main()