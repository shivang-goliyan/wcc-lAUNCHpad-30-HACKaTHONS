#!/usr/bin/env bash
# usage: gen.sh <name> <prompt-file> [extra reference images...]
# Generates one Nami image with Codex built-in image_gen, master-v1.png always attached.
set -u
D="$(cd "$(dirname "$0")" && pwd)"
name="$1"; pf="$2"; shift 2
direction="$(cat "$pf")"
full="Use your built-in image generation tool (not the CLI, do not run shell commands). The first attached image is the APPROVED MASTER of the Nami Care mascot otter. Use it as the identity reference. ${direction} Preserve exactly: the face, eyes, nose, fur colours and soft fur rendering, cream muzzle and belly, rounded ears, the sea-green knitted scarf with fringed ends, body proportions, lighting, camera angle, character size and the seated baseline position in the frame. Soft matte 2.5D animation style, diffuse warm studio lighting. One isolated character on a TRUE transparent background, square canvas, same framing and padding as the master, tail and scarf not cropped (unless the direction says the frame cuts her). No text, no labels, no collage, no extra characters, no floor, no cast shadow. Generate exactly one image, then reply with only the absolute path of the generated PNG."
out="$(printf '%s' "$full" | timeout 900 codex exec --skip-git-repo-check --sandbox read-only -C "$D" -i "$D/master-v1.png" "$@" - 2>&1)"
echo "$out" > "$D/logs/$name.log"
p="$(echo "$out" | grep -o '/home/ggtwo/.codex/generated_images/[^ )`]*\.png' | tail -1)"
if [ -n "$p" ] && [ -f "$p" ]; then
  cp "$p" "$D/out/$name.png" && echo "OK $name"
else
  echo "FAIL $name"
fi
