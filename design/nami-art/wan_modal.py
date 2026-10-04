"""Nami in-betweens on Modal: Wan 2.2 I2V-A14B first+last frame to video, then BiRefNet matting.

  modal run wan_modal.py --jobs jobs.json --out wan_out

jobs.json: [{"name": "greeting", "first": "_full/idle.png", "last": "_full/greeting.png", "prompt": "...", "frames": 33}]
Writes wan_out/<name>/NNN.png (RGBA, matted) and wan_out/<name>.mp4 (raw, for review).
"""
import io
import json
import os

import modal

app = modal.App("nami-wan")
models = modal.Volume.from_name("nami-models", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install(
        "torch==2.6.0", "torchvision==0.21.0",
        "diffusers>=0.35.1", "transformers>=4.49,<5", "accelerate", "ftfy", "sentencepiece",
        "imageio", "imageio-ffmpeg", "pillow", "numpy<2.3",
        "timm", "kornia", "einops", "hf_transfer",
    )
    .env({"HF_HOME": "/models/hf", "HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

BG = (128, 128, 128)  # flat grey behind Nami while Wan animates; matted out afterwards
NEG = ("blurry, low quality, deformed, extra limbs, extra fingers, extra arms, duplicate, morphing face, "
       "camera movement, zoom, background change, text, watermark, flicker, colour shift, static")


@app.function(image=image, gpu="H200", volumes={"/models": models}, timeout=5400)
def run(jobs: list[dict]) -> dict:
    import numpy as np
    import torch
    from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
    from diffusers.utils import export_to_video
    from PIL import Image
    from transformers import AutoModelForImageSegmentation
    from torchvision import transforms

    # two 14B experts (high-noise / low-noise); first+last frame comes from last_image
    mid = "Wan-AI/Wan2.2-I2V-A14B-Diffusers"
    vae = AutoencoderKLWan.from_pretrained(mid, subfolder="vae", torch_dtype=torch.float32)
    pipe = WanImageToVideoPipeline.from_pretrained(mid, vae=vae, torch_dtype=torch.bfloat16).to("cuda")

    mat = AutoModelForImageSegmentation.from_pretrained("ZhengPeng7/BiRefNet", trust_remote_code=True).to("cuda").eval().half()
    norm = transforms.Compose([transforms.Resize((1024, 1024)), transforms.ToTensor(),
                               transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
    models.commit()

    def flat(png: bytes, size: int) -> Image.Image:
        im = Image.open(io.BytesIO(png)).convert("RGBA").resize((size, size), Image.LANCZOS)
        bg = Image.new("RGBA", im.size, BG + (255,))
        bg.alpha_composite(im)
        return bg.convert("RGB")

    out = {}
    for j in jobs:
        size = j.get("size", 720)
        first = flat(j["first"], size)
        last = flat(j["last"], size) if j.get("last") else None
        g = torch.Generator("cuda").manual_seed(j.get("seed", 7))
        frames = pipe(image=first, last_image=last, prompt=j["prompt"], negative_prompt=j.get("neg", NEG),
                      height=size, width=size, num_frames=j.get("frames", 33),
                      num_inference_steps=j.get("steps", 40), guidance_scale=j.get("cfg", 3.5),
                      generator=g, output_type="pil").frames[0]
        tmp = f"/tmp/{j['name']}.mp4"
        export_to_video(frames, tmp, fps=16)
        mp4 = open(tmp, "rb").read()

        pngs = []
        for f in frames:
            with torch.no_grad():
                x = norm(f).unsqueeze(0).to("cuda").half()
                pred = mat(x)[-1].sigmoid()[0, 0].float().cpu().numpy()
            a = Image.fromarray((pred * 255).astype(np.uint8)).resize(f.size, Image.LANCZOS)
            rgba = f.convert("RGBA")
            rgba.putalpha(a)
            b = io.BytesIO()
            rgba.save(b, "PNG")
            pngs.append(b.getvalue())
        out[j["name"]] = {"mp4": mp4, "frames": pngs}
        print("done", j["name"], len(pngs))
    return out


@app.local_entrypoint()
def main(jobs: str, out: str = "wan_out"):
    spec = json.load(open(jobs))
    for j in spec:
        j["first"] = open(j["first"], "rb").read()
        j["last"] = open(j["last"], "rb").read() if j.get("last") else None
    res = run.remote(spec)
    os.makedirs(out, exist_ok=True)
    for name, r in res.items():
        open(f"{out}/{name}.mp4", "wb").write(r["mp4"])
        d = f"{out}/{name}"
        os.makedirs(d, exist_ok=True)
        for i, p in enumerate(r["frames"]):
            open(f"{d}/{i:03d}.png", "wb").write(p)
        print("saved", name, len(r["frames"]), "frames")
