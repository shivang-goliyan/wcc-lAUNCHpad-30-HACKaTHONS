# Handoff · Mon 5 Oct 2026, ~10:25 IST

Read this first after a context reset. **Submit the form by 13:30 IST** (closes 14:00). Feature work is done; what's left is the video and the form.

## Live
- **https://raynet.in**, served from the lead's shared VM `kgb-shadow-of-attire` (34.133.42.59, e2-standard-2 / 8 GB). Raynet runs in `~/raynet` via docker compose (web on 127.0.0.1:3320, worker, own Postgres). Host Caddy has a `raynet.in, www.raynet.in` block.
- Redeploy: `scripts/deploy-vm.sh ggtwo@34.133.42.59 raynet.in` (syncs source, builds on the VM, writes `~/raynet/.env` from local `.env.local` using the key list inside the script — add new env names there). A deploy causes ~30 s of 502s.
- VM rules (revenue box): own folder only, never restart other services, back up the Caddyfile, `caddy validate`, reload never restart.
- Scanner noise in web logs ("Server Reference ID … r2s") is React2Shell probes; harmless.

## What's built (all committed, GPG-signed, author shivang-goliyan, no AI trailer)
- **Landing**: scrapbook hero; one Nami who sits in each section's spot and walks between them (stands up first, walk cycle matched to speed, walks off toward off-screen spots); hero CTAs **Get started** (/start) + **Try the live demo** (/try); **"Let Nami call you"** section right after the hero (judge enters own number → real Twilio call); day scenes with ambient life; appointment replay on a phone; two homes; evidence notes; footer. Lenis smooth scroll.
- **/try** reuses this browser's Meera demo unless `?fresh=1`; `?next=/console` supported.
- **/app (Meera's screen)**: guide bar (① Book a doctor ② Miss a check-in ③ See it as Arjun · Nami calls your phone · How it works), skip labelled with the next event, proof (8 checks) at slot approval, green confirmed card, plain elder copy, "Behind the scenes (for judges)" log, judges panel (phone card first, booking, Arjun QR, clock, console, reset), Hey Nami switch, EN/हिं.
- **/start** onboarding (D22): 5 steps + parent's consent; demo clock starts 5 min before the parent's check-in.
- **/care/<token>** caregiver page; **/console** agent console with screen switcher; branded 404/error; Nami app icon.
- **Agents**: Gemini via OpenAI-compatible API, hedged fallbacks: `LLM_MODEL=gemini-3.5-flash-lite`, `LLM_FALLBACK_MODELS=gemini-3.1-flash-lite,gemma-4-26b-a4b-it,gemini-2.5-flash-lite` (AI Studio quotas: 3.5/3.1 Flash-Lite 500 RPD, Gemma 4 14.4K RPD, 2.5 Flash-Lite only 20 RPD). Chat ~2–3 s.
- **Voice**: Hindi + Hinglish = Gemini TTS (Vindemiatrix, `TTS_GEMINI_LANGS=hi,hing`, ~10 RPD per model per project, falls back to Fish); English = Fish (`4d7609…` "Girl hindi"), streamed via `GET /api/tts?t=` (first byte ~0.5 s, speech starts ~2 s). Deepgram Nova-3 STT.
- **Hey Nami** wake word (D23): `public/wakeword/` (openWakeWord mel/embedding + our `hey_nami.onnx`), onnxruntime-web from jsDelivr; 73/78 detections across 14 unseen voices; "Tap anywhere to start listening" + chime on detection.
- **Phone calls (D25)**: KGB Twilio account (API key in `.env.local`: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID/SECRET`, `TWILIO_FROM` = +1 614 … Rainmaker Columbus, `CALL_WEBHOOK_SECRET`). `realCallGate` in `lib/calls/runtime.ts`: `REAL_CALLS=off` kill switch, +91 mobiles and +1 only, 2/number/day, 2/demo home, 20/day site-wide (`CALLS_PER_DAY`), 4/IP/hour, 3-min `timeLimit`. Balance was $13.44 at 07:30 (~$0.05/min to Indian mobiles). The lead tested a real call: works. Companion call = same agent + tools + crisis checks, Polly.Aditi voice.
- **Safety**: phrase net + Jev classifier (`lib/server/safetyCheck.ts`), used on screen and on calls.
- **Evals** (published in /console from machine files): engine 28/28; 30 sim calls 0 false confirmations / 0 disclosure; intents 54/60 on 3.5 Flash-Lite (safety 10/12, misses caught by phrase net); 2.5 Flash-Lite 54/60 safety 12/12 (`eval/results/`).
- Docs: `docs/DECISIONS.md` D1–D25, `README.md`, `docs/SUBMISSION.md` (video script + form answers), audits in `~/.cache/raynet-work/audit/` (ux-report.md, bug-report.md).

## Local dev
- Postgres container `nami-pg` (127.0.0.1:55432); `pnpm dev` on :3000. The **worker** isn't running locally (simulated clinic calls need `tsx worker/index.ts`; run it with `REAL_CALLS=off` locally). After a reboot: `docker start nami-pg`, restart `pnpm dev`.
- `.env.local` is git-ignored and holds every key. Never print or commit it.
- QA scripts in `~/.cache/raynet-work/`: `flow.mjs` (full judge flow via API, BASE env), `judge.mjs` (chat on phone size), `walk2.mjs` (Nami motion metrics), `spots.mjs` (Nami at every spot), `wwtest.mjs` (wake word with fake mic), `pages.mjs`, `playtest.mjs` (voice start time). Repo: `scripts/qa/shot.mjs`.
- Voice samples for the lead: `~/Desktop/nami-voices/` (6 comparison clips + `fish-hindi/` 14 Fish voices).

## Remaining before 13:30
1. Record the video (script in `docs/SUBMISSION.md`; update it to show: Get started, the "Let Nami call you" phone call, the guide bar steps). Say "simulated clinic" on camera.
2. Form answers (`docs/SUBMISSION.md` §2) — need **team name (CAPS) and members/roles** from the lead; add the phone-call feature and wake word to the answers.
3. Before submitting: make the GitHub repo public (it's private now; nothing pushed this session — ask the lead before pushing), scan for keys (`git log -p | grep -E "AIza|sk-|AC[0-9a-f]{32}|SK[0-9a-f]{32}"` should be empty), `.env*` never committed.

## Known, not fixed
- /app preloads all mascot clips (~5.5 MB); some engine reply lines stay English in Hindi mode; demo-home creation isn't rate-limited; Gemini Hindi voice quota is small (falls back to Fish).

## Later (after the hackathon)
Research-led onboarding v2 with accounts, real interviews/survey, daily check-in calls to the elder's phone, streaming audio player (MSE) for sub-second voice start.
