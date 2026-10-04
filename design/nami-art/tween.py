"""RIFE in-betweens for a pose change, with real transparency.

  tween.py <pose> [mid]   -> pub/<pose>-tween.webp: idle -> (mid) -> pose as one strip of 384px frames
                           (mid = a painted halfway frame in _full/, RIFE fills the gaps)

RIFE only does RGB, so colour and alpha are interpolated separately. Colour is
bled out past the edges first so nothing dark leaks in at the silhouette.
"""
import sys, os, subprocess, shutil, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RIFE = os.path.join(HERE, "..", "rife", "rife-ncnn-vulkan")
MODEL = os.path.join(HERE, "..", "rife", "rife-v4.6")
FULL = os.path.join(HERE, "_full"); PUB = os.path.join(HERE, "pub"); DBG = os.path.join(HERE, "dbg")
W = 768      # interpolate at this size
FRAME = 384  # shipped frame size


def bleed(rgb, alpha):
    """push edge colours out into the transparent area, so interpolation never mixes in black."""
    import cv2
    known = (alpha > 128).astype(np.uint8)
    out = rgb.copy()
    for _ in range(40):
        if known.all():
            break
        blur = cv2.blur(out * known[..., None], (5, 5))
        cnt = cv2.blur(known.astype(np.float32), (5, 5))[..., None]
        grow = (cnt[..., 0] > 0) & (known == 0)
        out[grow] = (blur[grow] / cnt[grow])
        known = known | grow.astype(np.uint8)
    return out


def load(name):
    a = np.array(Image.open(os.path.join(FULL, f"{name}.png")).convert("RGBA").resize((W, W), Image.LANCZOS)).astype(np.float32)
    return bleed(a[..., :3], a[..., 3]), a[..., 3]


def rife(img0, img1, t, tmp, tag):
    p0, p1, po = (os.path.join(tmp, f"{tag}{s}.png") for s in ("0", "1", "o"))
    Image.fromarray(img0).save(p0); Image.fromarray(img1).save(p1)
    subprocess.run([RIFE, "-0", p0, "-1", p1, "-o", po, "-m", MODEL, "-s", f"{t:.4f}"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return np.array(Image.open(po).convert("RGB")).astype(np.float32)


def between(a, b, n, tmp):
    (ca, aa), (cb, ab) = a, b
    out = []
    for i in range(1, n + 1):
        t = i / (n + 1)
        col = rife(ca.astype(np.uint8), cb.astype(np.uint8), t, tmp, "c")
        al = rife(np.repeat(aa[..., None], 3, 2).astype(np.uint8), np.repeat(ab[..., None], 3, 2).astype(np.uint8), t, tmp, "a").mean(axis=2)
        out.append(np.concatenate([np.clip(col, 0, 255), al[..., None]], axis=2).astype(np.uint8))
    return out


def raw(name):
    return np.array(Image.open(os.path.join(FULL, f"{name}.png")).convert("RGBA").resize((W, W), Image.LANCZOS))


def main():
    pose = sys.argv[1]
    mid = sys.argv[2] if len(sys.argv) > 2 else None
    tmp = tempfile.mkdtemp()
    idle, end = load("idle"), load(pose)
    if mid:
        m = load(mid)
        frames = between(idle, m, 2, tmp) + [raw(mid)] + between(m, end, 2, tmp)
    else:
        frames = between(idle, end, 4, tmp)
    shutil.rmtree(tmp)
    n = len(frames)
    strip = Image.new("RGBA", (FRAME * n, FRAME))
    for i, f in enumerate(frames):
        strip.paste(Image.fromarray(f).resize((FRAME, FRAME), Image.LANCZOS), (i * FRAME, 0))
    dst = os.path.join(PUB, f"{pose}-tween.webp")
    strip.save(dst, "WEBP", quality=80, method=6)
    prev = Image.new("RGBA", strip.size, (247, 243, 234, 255)); prev.alpha_composite(strip)
    prev.convert("RGB").save(os.path.join(DBG, f"tween-{pose}.jpg"), quality=85)
    print("ok", pose, "frames", n, os.path.getsize(dst) // 1024, "KB")


if __name__ == "__main__":
    main()
