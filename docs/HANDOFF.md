# Handoff — Mon 5 Oct 2026, ~05:05 IST

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

## In progress
1. **Onboarding flow (D22)** — `lib/onboarding.ts` written (zod `OnboardProfile` + pure `applyProfile()`), committed as WIP. **Still to do:** vitest for `applyProfile`; extend `createHousehold` (lib/db/repo.ts) with an optional `profile` (apply after `seedHousehold`, event summary uses the parent's name); `POST /api/onboard` (zod, sets household cookie like `/try`); `/start` page: Nami asks each step with big buttons (who's setting up → parent name/addressAs/city/language → check-in time + medicines + water/walk → first and second contact → clinic → hand the phone to the parent: Nami asks consent in their language, "Haan, theek hai" / "Abhi nahi"; household is created only after that yes) → redirect to `/app`. Link it from the landing nav ("Set up for your parent"). Then redeploy.
2. **"Hey Nami" wake word** — Picovoice is out (free tier ended 30 Jun 2026; 7-day trial; $6k/yr). A background agent is training an openWakeWord `hey_nami.onnx` on Modal; it writes progress to `~/.cache/raynet-work/wakeword/PROGRESS.md` and outputs to `~/.cache/raynet-work/wakeword/out/` (hey_nami.onnx + melspectrogram.onnx + embedding_model.onnx). When done: integrate in the browser with onnxruntime-web (always-on listening on Meera's screen, on-device; on detection start the voice loop), keep Talk/Space as the fallback, then redeploy.

## Next after those
Live judge-flow test on a phone (sandbox → booking → QR caregiver → console), final fixes, **freeze 10:00**, record the video 10:00–12:00 (script in docs/SUBMISSION.md), form answers + submit by 13:30 (make the GitHub repo public first; check no keys are committed).

## Needed from the lead
Team name (CAPS) + members/roles; Nami's voice pick (`preview/voices/`, placeholder `girl-hindi`); Twilio creds + 2 verified phones if real calls are wanted in the video.

## Later (after the hackathon)
Research-led onboarding v2, our own wake-word model improvements, real interviews/survey.
