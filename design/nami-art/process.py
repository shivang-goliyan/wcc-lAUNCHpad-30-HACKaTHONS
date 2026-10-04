"""Turn Codex outputs into aligned runtime assets.

  process.py pose <name> <src.png>                 -> pub/<name>.webp (+ _full/<name>.png)
  process.py overlay <pose> <part> <edit.png> [--full]  -> pub/<pose>-<part>.webp
     overlay: align edit onto the processed pose, keep only the changed region
     --full: keep the whole aligned edit (wave frame)
"""
import sys, os
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "pub"); FULL = os.path.join(HERE, "_full"); DBG = os.path.join(HERE, "dbg")
for d in (PUB, FULL, DBG): os.makedirs(d, exist_ok=True)
CANVAS = 1024   # working canvas
OUT = 768       # shipped size


def load(p):
    return np.array(Image.open(p).convert("RGBA"))


def to_canvas(a):
    # generator gives 1254 squares with the same framing; just resample
    return cv2.resize(a, (CANVAS, CANVAS), interpolation=cv2.INTER_AREA)


def save_webp(a, path, q=86):
    im = Image.fromarray(cv2.resize(a, (OUT, OUT), interpolation=cv2.INTER_AREA))
    im.save(path, "WEBP", quality=q, method=6, exact=False)


def gray_on(a, bg=128.0):
    rgb = a[..., :3].astype(np.float32); al = a[..., 3:4].astype(np.float32) / 255
    g = (rgb * al + bg * (1 - al)).mean(axis=2)
    return g.astype(np.float32) / 255


def align(base, edit):
    """affine-align edit onto base (ECC on a downscaled grey composite)."""
    s = 0.5
    b = cv2.resize(gray_on(base), None, fx=s, fy=s); e = cv2.resize(gray_on(edit), None, fx=s, fy=s)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(b, e, warp, cv2.MOTION_AFFINE,
                                       (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), None, 5)
    except cv2.error as ex:
        print("ECC failed, using identity:", ex)
    warp[:, 2] /= s
    out = cv2.warpAffine(edit, warp, (CANVAS, CANVAS), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    print("warp", np.round(warp, 4).tolist())
    return out


def changed_mask(base, edit):
    rgb_b = base[..., :3].astype(np.float32); rgb_e = edit[..., :3].astype(np.float32)
    vis = (np.minimum(base[..., 3], edit[..., 3]) > 200)
    d = np.linalg.norm(rgb_b - rgb_e, axis=2) * vis
    d = cv2.GaussianBlur(d, (0, 0), 6)
    m = (d > 38).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return np.zeros(m.shape, np.float32), d
    # keep blobs that are at least 15% of the biggest one (both eyes, not fur noise)
    areas = stats[1:, cv2.CC_STAT_AREA]; keep = np.zeros_like(m)
    for i, a in enumerate(areas, start=1):
        if a >= 0.15 * areas.max():
            keep[lab == i] = 1
    keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    soft = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 7)
    return np.clip(soft * 1.4, 0, 1), d


def shrink_to_bottom(a, k):
    """scale about the bottom-centre (peek: the ledge stays at the canvas bottom)."""
    small = cv2.resize(a, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    out = np.zeros_like(a); h, w = small.shape[:2]
    x0 = (CANVAS - w) // 2
    out[CANVAS - h:, x0:x0 + w] = small
    return out


def cmd_pose(name, src, scale=1.0):
    a = to_canvas(load(src))
    if scale != 1.0:
        a = shrink_to_bottom(a, scale)
    Image.fromarray(a).save(os.path.join(FULL, f"{name}.png"))
    save_webp(a, os.path.join(PUB, f"{name}.webp"))
    bb = Image.fromarray(a[..., 3]).point(lambda v: 255 if v > 20 else 0).getbbox()
    print(name, "bbox", bb)


def cmd_overlay(pose, part, src, full=False):
    base = load(os.path.join(FULL, f"{pose}.png"))
    edit = align(base, to_canvas(load(src)))
    if full:
        out = edit
    else:
        m, d = changed_mask(base, edit)
        out = edit.copy()
        out[..., 3] = (edit[..., 3].astype(np.float32) * m).astype(np.uint8)
        cv2.imwrite(os.path.join(DBG, f"{pose}-{part}-diff.png"), np.clip(d * 3, 0, 255).astype(np.uint8))
    save_webp(out, os.path.join(PUB, f"{pose}-{part}.webp"), q=90)
    # debug: base with overlay on top, cropped around the overlay
    comp = Image.fromarray(base); comp.alpha_composite(Image.fromarray(out))
    comp.save(os.path.join(DBG, f"{pose}-{part}-comp.png"))
    print(pose, part, "overlay bbox", Image.fromarray(out[..., 3]).getbbox())


if __name__ == "__main__":
    c = sys.argv[1]
    if c == "pose": cmd_pose(sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 1.0)
    elif c == "overlay": cmd_overlay(sys.argv[2], sys.argv[3], sys.argv[4], "--full" in sys.argv)
