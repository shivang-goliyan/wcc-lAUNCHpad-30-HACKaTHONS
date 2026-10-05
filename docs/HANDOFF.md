# Handoff · Mon 5 Oct 2026, ~05:35 IST

Read this first after a context reset. Deadline: **feature freeze 10:00, form submitted by 13:30 IST** (closes 14:00).

## Live
- **https://raynet.in** is live (Let's Encrypt cert), served from the lead's shared VM `kgb-shadow-of-attire` (34.133.42.59, now e2-standard-2 / 8 GB, static IP). Raynet runs in `~/raynet` via `docker compose` (web on 127.0.0.1:3320, worker, own Postgres; memory-capped). Host Caddy has a `raynet.in, www.raynet.in` block (backup `/etc/caddy/Caddyfile.bak-raynet-*`).
- Redeploy: `scripts/deploy-vm.sh ggtwo@34.133.42.59 raynet.in` (syncs source, builds ON the VM — the home uplink stalls on big uploads — writes `~/raynet/.env` from local `.env.local`, compose up, Caddy block only if missing).
- Verified live: `/`, `/try` → `/app`, `/console`, clips, chat agent (Gemini), Fish TTS, Deepgram token, Jev crisis classifier.
- VM rules (revenue box): own folder only, never restart other services, back up Caddyfile, `caddy validate`, reload never restart.

## Local dev
- Postgres container `nami-pg` on 127.0.0.1:55432; `pnpm dev` on :3000 (log in the session scratchpad `dev.log`). After a reboot: `docker start nami-pg`, restart `pnpm dev`.
- `.env.local` (git-ignored) holds: OpenRouter ×2, Fish, Deepgram, 6 Gemini keys (key 5 is denied — excluded), `LLM_PROVIDER=openai`, `LLM_BASE_URL` = Gemini OpenAI endpoint, `LLM_MODEL=gemini-3.5-flash-lite`, `LLM_API_KEYS` = the 5 good Gemini keys, `TYPESAFE_API_KEY` (Jev).
- Working files outside the repo (survive reboots): `~/.cache/raynet-work/` (designs, assets, shots, deploy logs). `/tmp` is wiped on reboot — never keep anything there.
- QA helpers in repo: `scripts/qa/shot.mjs` (screenshots; `FULL=1` full page), `scripts/qa/scrollrec.mjs` (scroll recording + Nami pose log).

## Done (all committed, GPG-signed, author shivang-goliyan, no AI trailer)
Painted Nami + 30 Wan 2.2 clips (stacked-alpha MP4 + WebGL player, clip graph: sit/stand/walk/wave/call/sleep, loops); landing redesign (scrapbook hero #2, "A day with Nami" D with Nami walking through 4 painted Jaipur scenes, appointment thread A, two homes B with red thread, evidence/promises notes); talking Nami (bubbles, "Let Nami talk", poke); voice loop (Deepgram → agent → Fish, browser fallbacks); provider-agnostic LLM (Gemini key rotation, timeout failover); crisis net + Jev classifier (D20); Raynet brand (D21); evals published (engine 28/28, 30 sim calls 0 false confirmations / 0 disclosure, intents 54/60); README, research/evidence-2026.md, docs/SUBMISSION.md (video script + form answers).

## Done this morning (05:05 to 05:35)
- Landing: one Nami only (the server-rendered hero copy is gone), she sits on the open page instead of over the photo prints; Meera's day note ticks itself off while Nami narrates; chai steam, drifting jasmine; day scenes have birds, light, steam, lamp flicker, fireflies and a slow camera drift; Lenis smooth scrolling; idle moves when the page is still; cheers on CTA hover; no swim flicker on fast scroll; never parked half-transparent between slots; the appointment conversation replays live with typing dots and ticking checks. Em dashes and "gentle" removed from visible copy.
- Onboarding (D22) shipped: `/start`, `POST /api/onboard`, `createHousehold({ profile })`, `lib/onboarding.test.ts` (12 tests). Linked from the nav and under the hero CTA. The app now uses the household's own names everywhere (agent notes, greeting, captions, examples); a Hindi household opens in Hindi. Verified live on raynet.in.
- Wake word (D23): `lib/client/wakeword.ts` + `components/app/useWakeWord.ts` + toggle under the Talk button. Mel/embedding models are in `public/wakeword/`; ORT wasm comes from jsDelivr. Tested end to end with a dummy classifier and a fake mic (detection starts the voice loop). **The toggle stays hidden until `public/wakeword/hey_nami.onnx` exists.**

## Since 05:35
- hey_nami.onnx shipped (v2, trained on Modal; natural voice 0.97 to 1.00, plain speech under 0.01; threshold 0.5, 2.5 s cool-down). Verified live on raynet.in with a fake mic: "Hey Nami" opens the conversation, 20 s of ordinary speech does not. Not yet tried by a real human voice: say it into a laptop mic before the video.
- Gemini Flash-Lite went 503 / 9 s per reply this morning. `compatChat` now hedges to `LLM_FALLBACK_MODELS=gemini-2.5-flash-lite,gemini-3.5-flash` after 4 s or on any 5xx; empty tool-turn replies fall back to the tool's hint; replies follow the language of the last message. Live chat back to ~2 s. Fallback model eval: 54/60, safety 12/12.
- raynet.in deployed at ~05:45 with everything except the restyled Hey Nami pill (5e693f3); include it in the final deploy.

## Next after those
Live judge-flow test on a phone (sandbox → booking → QR caregiver → console), final fixes, **freeze 10:00**, record the video 10:00–12:00 (script in docs/SUBMISSION.md), form answers + submit by 13:30 (make the GitHub repo public first; check no keys are committed).

## Needed from the lead
Team name (CAPS) + members/roles; Nami's voice pick (`preview/voices/`, placeholder `girl-hindi`); Twilio creds + 2 verified phones if real calls are wanted in the video.

## Later (after the hackathon)
Research-led onboarding v2, our own wake-word model improvements, real interviews/survey.
