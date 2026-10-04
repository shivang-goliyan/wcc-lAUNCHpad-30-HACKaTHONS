"""Pack matted Wan clips into stacked-alpha MP4s for the site.

  pack_clips.py <wan_dir> <public_nami_dir> <clips_ts>

- colour-matches every frame to the painted stills (gain eased from the first pose to the last),
  so handing over between a still and a clip never flickers
- transitions: every 2nd frame, 30 fps, plus a reversed copy; loops: every frame minus the seam duplicate, 16 fps
- each MP4 is H.264, colour on top and alpha below (colour bled past the edges); a WebGL shader
  recombines them, which works in every browser (Safari has no VP9 alpha)
- walk loops are two half-steps joined; the wave loop is greeting~greeting-b played there and back
"""
import os, sys, glob, json, shutil, subprocess, tempfile
import numpy as np
import cv2
from PIL import Image

WAN, PUB, TS = sys.argv[1], sys.argv[2], sys.argv[3]
FULL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_full")
CELL, COLS = 384, 8


def frames(name):
    fs = sorted(glob.glob(os.path.join(WAN, name, "*.png")))
    return [np.array(Image.open(f).convert("RGBA").resize((CELL, CELL), Image.LANCZOS)).astype(np.float32) for f in fs]


def still(p):
    return np.array(Image.open(os.path.join(FULL, f"{p}.png")).convert("RGBA").resize((CELL, CELL), Image.LANCZOS)).astype(np.float32)


def gain(ref, fr):
    m = (ref[..., 3] > 240) & (fr[..., 3] > 240)
    if m.sum() < 500:
        return np.ones(3, np.float32)
    return np.clip(ref[..., :3][m].mean(0) / np.maximum(fr[..., :3][m].mean(0), 1), 0.85, 1.15)


def match(fs, a, b):
    ga, gb = gain(still(a), fs[0]), gain(still(b), fs[-1])
    out = []
    for i, f in enumerate(fs):
        t = i / max(1, len(fs) - 1)
        g = ga * (1 - t) + gb * t
        f = f.copy()
        f[..., :3] = np.clip(f[..., :3] * g, 0, 255)
        out.append(f)
    return out


def bleed(rgb, alpha):
    """push edge colours into the transparent area so compression never drags dark fringes in."""
    known = (alpha > 128).astype(np.uint8)
    out = rgb.copy()
    for _ in range(24):
        if known.all():
            break
        blur = cv2.blur(out * known[..., None], (5, 5))
        cnt = cv2.blur(known.astype(np.float32), (5, 5))[..., None]
        grow = (cnt[..., 0] > 0) & (known == 0)
        out[grow] = blur[grow] / cnt[grow]
        known = known | grow.astype(np.uint8)
    return out


def encode(fs, fname, fps):
    tmp = tempfile.mkdtemp()
    for i, f in enumerate(fs):
        col = bleed(f[..., :3], f[..., 3])
        st = np.zeros((CELL * 2, CELL, 3), np.uint8)
        st[:CELL] = np.clip(col, 0, 255).astype(np.uint8)
        st[CELL:] = np.repeat(f[..., 3:4], 3, 2).astype(np.uint8)
        Image.fromarray(st).save(os.path.join(tmp, f"{i:03d}.png"))
    path = os.path.join(PUB, "clips", fname)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-i", os.path.join(tmp, "%03d.png"),
                    "-vf", "scale=out_color_matrix=bt709:out_range=tv", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                    "-crf", "22", "-preset", "slow", "-tune", "animation", "-g", str(len(fs)), "-movflags", "+faststart",
                    "-an", path], check=True)
    shutil.rmtree(tmp)
    return os.path.getsize(path) // 1024


def sheet(fs, key, fps, reverse=False):
    os.makedirs(os.path.join(PUB, "clips"), exist_ok=True)
    base = key.replace("~", "-to-").replace("@", "-")
    kb = encode(fs, base + ".mp4", fps)
    extra = ""
    if reverse:
        kb += encode(fs[::-1], base + ".rev.mp4", fps)
        extra = " (+reversed)"
    print(f"{key:26s} {len(fs):3d} frames {fps}fps {kb:5d} KB{extra}")
    return {"src": f"/nami/clips/{base}.mp4", "frames": len(fs), "cols": 1, "fps": fps, **({"rev": f"/nami/clips/{base}.rev.mp4"} if reverse else {})}


def have(name):
    return os.path.isdir(os.path.join(WAN, name)) and len(os.listdir(os.path.join(WAN, name))) > 0


out = {}
skip = {"walk~walk-b", "walk-b~walk", "walk-left~walk-left-b", "walk-left-b~walk-left", "greeting~greeting-b", "walk-ip-a", "walk-ip-b"}
for d in sorted(os.listdir(WAN)):
    if not have(d) or d in skip:
        continue
    fs = frames(d)
    if "@loop" in d:
        p = d.split("@")[0]
        out[d] = sheet(match(fs, p, p)[:-1], d, 16)
    elif "~" in d:
        a, b = d.split("~")
        m = match(fs, a, b)
        picked = m[::2] if len(m) > 20 else m
        if (len(m) - 1) % 2:  # always end exactly on the target pose
            picked.append(m[-1])
        out[d] = sheet(picked, d, 30, reverse=True)

# walk cycle: cut the cleanest loop out of a free-running walk (WALK_SRC), mirror it for the left
def best_loop(fs, lo=10, hi=40):
    small = [cv2.resize(f, (96, 96), interpolation=cv2.INTER_AREA) for f in fs]
    best = None
    for i in (0,):  # start on the walk still itself, so stand~walk hands over cleanly
        for j in range(i + lo, min(len(fs), i + hi + 1)):
            d = float(np.abs(small[i] - small[j]).mean())
            if best is None or d < best[0]:
                best = (d, i, j)
    return best


src = os.environ.get("WALK_SRC")
if src and have(src):
    fs = frames(src)
    d, i, j = best_loop(fs)
    cyc = match(fs[i:j], "walk", "walk")
    print(f"walk loop from {src}: frames {i}..{j} (seam diff {d:.1f})")
    out["walk@loop"] = sheet(cyc, "walk@loop", 16)
    out["walk-left@loop"] = sheet([f[:, ::-1].copy() for f in cyc], "walk-left@loop", 16)

# wave: there and back
if have("greeting~greeting-b"):
    w = match(frames("greeting~greeting-b"), "greeting", "greeting-b")
    out["greeting@loop"] = sheet(w[:-1] + w[::-1][:-1], "greeting@loop", 16)

with open(TS, "w") as f:
    f.write("// generated by design/nami-art/pack_clips.py from the Wan clips; do not edit by hand\n")
    f.write("import type { Clip } from './art';\n\n")
    f.write("export const WAN_CLIPS: Record<string, Clip> = " + json.dumps(out, indent=2) + ";\n")
print(len(out), "clips ->", TS)
