#!/usr/bin/env bash
# gen.sh <name> -> out/<name>.png : one painted site asset from prompts/<name>.txt
set -u
D="$(cd "$(dirname "$0")" && pwd)"
name="$1"; direction="$(cat "$D/prompts/$name.txt")"
full="Use your built-in image generation tool (do not run shell commands). Create ONE illustration asset for a website, in exactly the same soft painted 2.5D storybook style as the attached images (the first is Nami the otter, the second is the world she lives in): warm diffuse light, gentle painterly texture, Indian setting, calm and dignified. All people are painted illustrations in that style, never photographs. NO text, letters, logos, watermarks or UI anywhere in the image. ${direction} Generate exactly one image, then reply with only the absolute path of the generated PNG."
out="$(printf '%s' "$full" | timeout 900 codex exec --skip-git-repo-check --sandbox read-only -C "$D" -i "$D/nami.png" -i "$D/concept.png" - 2>&1)"
echo "$out" > "$D/logs/$name.log"
p="$(echo "$out" | grep -o '/home/ggtwo/.codex/generated_images/[^ )`]*\.png' | tail -1)"
if [ -n "$p" ] && [ -f "$p" ]; then cp "$p" "$D/out/$name.png" && echo "OK $name"; else echo "FAIL $name: $(echo "$out" | grep -i -E 'error|limit' | tail -1 | cut -c1-160)"; fi
