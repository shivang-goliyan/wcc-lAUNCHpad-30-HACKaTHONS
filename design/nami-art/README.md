# Nami art pipeline

How the painted Nami in `public/nami/` was made (decision D18). No paid API was used.

1. `concept-crop.png` is Nami cut from the concept art in `docs/source/Nami-Care-Product-Workflow.pdf`.
2. `master.png` was generated from it with Codex's built-in image generation (ChatGPT plan), on a real transparent background.
3. `gen.sh <name> prompts/<name>.txt` makes each pose with the master attached as the identity reference.
   `prompts-mid/` are the painted halfway frames used for pose changes (the target pose is attached too).
4. `gen-edit.sh` makes same-pose edits (blink, mouth shapes; the list is `edits.tsv`).
5. `process.py pose|overlay` resamples to one 1024 canvas, aligns each edit to its pose (OpenCV ECC), keeps only
   the changed region with a feathered mask, and writes 768px WebP.
6. `tween.py <pose> [mid-<pose>]` builds the idle → pose strip: painted halfway frame plus RIFE
   (rife-ncnn-vulkan, model v4.6, runs on the local GPU) in-betweens, colour and alpha interpolated separately.

The scripts expect a Python venv with opencv-python-headless and Pillow at `../venv`, and the RIFE binary at
`../rife`, relative to the folder they run in. `lib/nami/art.ts` lists which files exist; `lib/nami/art.test.ts`
fails if any referenced file is missing.

## Motion (D19)

7. `make_jobs.py` writes the clip list (transitions between our own painted poses, and living loops whose
   first and last frame are the pose itself), split over four Modal accounts.
8. `wan_modal.py` runs Wan 2.2 I2V-A14B (first + last frame) on an H200 and mattes every frame with BiRefNet:
   `MODAL_PROFILE=<account> modal run wan_modal.py --jobs jobs-0.json --out wan_prod`.
9. `pack_clips.py wan_prod public/nami lib/nami/clips.ts` colour-matches each clip to the stills at both ends,
   keeps every 2nd frame of transitions (30 fps) and whole loops (16 fps), and writes stacked-alpha H.264 MP4s
   (colour on top, alpha below, BT.709-tagged) plus a reversed copy of every transition.
   `components/nami/clipPlayer.ts` recombines them with a WebGL shader, which works in every browser.
