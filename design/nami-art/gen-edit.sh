#!/usr/bin/env bash
# usage: gen-edit.sh <out-name> <base.png> <what to change>
set -u
D="$(cd "$(dirname "$0")" && pwd)"
name="$1"; base="$2"; what="$3"
full="Use your built-in image generation tool to EDIT the attached image (do not run shell commands). ${what} Change nothing else at all: keep the exact same pose, paws, scarf, fur, colours, lighting, character position, size and framing, and the same true transparent background. The result must line up pixel-for-pixel with the original everywhere except the changed feature. Generate exactly one image, then reply with only the absolute path of the generated PNG."
out="$(printf '%s' "$full" | timeout 900 codex exec --skip-git-repo-check --sandbox read-only -C "$D" -i "$base" - 2>&1)"
echo "$out" > "$D/logs/edit-$name.log"
p="$(echo "$out" | grep -o '/home/ggtwo/.codex/generated_images/[^ )`]*\.png' | tail -1)"
if [ -n "$p" ] && [ -f "$p" ]; then cp "$p" "$D/edits/$name.png" && echo "OK $name"; else echo "FAIL $name"; fi
