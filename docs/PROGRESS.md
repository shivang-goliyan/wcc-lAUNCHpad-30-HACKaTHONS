# Nami Care — progress report

**As of:** Sun 4 Oct 2026, 17:00 IST
**Branch:** `claude/zealous-edison-q6w07k`
**Deadline:** form submitted by Mon 5 Oct, 13:30 IST

This document records what has been built so far, what works, what is simulated, what is still missing, and what's needed from the team lead.

---

## 1. Summary

| Area | Status |
|---|---|
| Product and technical spec (PRD, TRD, agents, design, build plan, decision log) | ✅ Done |
| Care workflow engine (reminders, check-in ladder, Get Help, appointments, approvals, Memory Corner) | ✅ Done, 28/28 tests passing |
| Deterministic verifiers (slot, consent, data disclosure, crisis phrases) | ✅ Done, tested |
| Database layer (Postgres, per-household lock, transactional outbox, events) | ✅ Done, tested end to end on a real Postgres |
| Call agents (Caller, Clinic simulator, Extractor) on Claude Opus 5.5 | ✅ Code done. Scripted fallback tested; the **LLM path needs an Anthropic key** |
| Real phone calls (Twilio US number, Say/Gather turn loop, voicemail detection) | ✅ Code done. **Untested until Twilio keys arrive** |
| Browser voice (OpenAI Realtime over WebRTC, tool bridge, lip-sync) | ✅ Code done. **Untested until an OpenAI key arrives** |
| Text mode (Claude with the same tools) plus browser speech | ✅ Code done. Needs an Anthropic key |
| Mascot "Nami" (hand-built SVG rig, 14 poses, blinking, eye tracking, lip-sync) | ✅ Done |
| Meera's companion screen `/app` | ✅ Done |
| Caregiver phone page `/care/[token]` | ✅ Done |
| Agent console for judges `/console` | ✅ Done |
| Landing page `/` with Nami roaming | 🟡 **In progress.** Committed as work-in-progress at the lead's request |
| Eval harness (engine, 60 intents, simulated calls) | ✅ Engine and scripted calls run. Intent and LLM-call evals need an Anthropic key |
| VM deployment (Docker Compose, Caddy HTTPS, Postgres, worker) | ✅ Files done. The image build couldn't be tested here because the sandbox proxy blocks npm TLS; it needs a first build on the VM |
| README for judges | ✅ Done (needs the live link and video link added) |
| Problem evidence: interviews and survey | ❌ **Not started. This is the team's job** (15 rubric points) |
| Demo video | ❌ Not started (Monday morning) |

---

## 2. What was decided, and why

The full log is in `docs/DECISIONS.md`. The headline decisions:

- **A website, not a desktop app.** Judges need a live link.
- **Hosted on the team's VM** with Docker Compose: Caddy for HTTPS, Next.js, a worker, and Postgres.
- **Twilio from a US number** places the real calls in the video. Judges use an AI "simulated clinic" plus a QR code that turns their own phone into the caregiver.
- **Nami is drawn in code**, as a layered SVG. There were no designers, and Higgsfield had 0 credits. It is based on the Codex concept art.
- **"LLMs propose, code disposes."** Only the deterministic engine can change care state.
- **Text agents run on `claude-opus-5-5`.** **Voice runs on OpenAI `gpt-realtime-2.1`**, with Gemini Live as an option if Hindi quality is better.

---

## 3. What exists, area by area

### 3.1 Docs (`docs/`)

- `PRD.md`: problem and evidence, users, positioning against ElliQ, Saathi and others, P0/P1/P2 scope, acceptance criteria, the 3-minute video script, and the rubric mapping.
- `TRD.md`: architecture, stack, data model, state machines, APIs, adapters, security and limits, environment variables, tests and deployment.
- `AGENTS.md`: the agent roster, every prompt, the tool schemas, the eval design and a draft of the form answers.
- `DESIGN.md`: the website pages, design tokens, mascot spec, animation contract and lip-sync.
- `BUILD-PLAN.md`: the hour-by-hour plan, go/no-go gates, P0 checklist, form-answer drafts and the 6-question survey.
- `DECISIONS.md`: decisions D1–D17 and open questions.
- `source/`: **the files the lead shared in chat**, unchanged:
  - `Nami-Care-Product-Workflow.md`
  - `Nami-Care-Product-Workflow.pdf`
  - `Nami-Care-Mascot-Generation-and-Animation.md`
- `design/reference/concept-000.png`: the Codex concept art, extracted from the PDF.
- `research/`: sourced research from idea selection (LASI, HelpAge, NSO and others).

### 3.2 Workflow engine (`lib/engine/`)

The engine is pure TypeScript. It never reads the clock; virtual time is passed in.

- **Reminders.** Each occurrence has its own outcome:
  - `taken_reported`
  - `not_taken_reported`
  - `snoozed`
  - `help_requested`
  - `unacknowledged`
  - `delivery_uncertain`

  A duplicate acknowledgement is ignored. Snoozing moves the notification, not the prescribed time.
- **Check-in ladder.** The case moves through these states:
  1. awaiting_response
  2. retrying_page
  3. phone_fallback
  4. escalating to Arjun, then Priya
  5. owner_accepted
  6. resolved_human_reported

  There is also `unresolved`, and a late acceptance still counts. Quiet hours and planned absence are respected. Evidence is factual only, such as "Nami page last seen 09:58".
- **Get Help** is immediate, has a "pressed by mistake" option, and the reply always mentions 112.
- **Appointments.** The flow is:
  1. draft
  2. permission to call
  3. finding_availability
  4. awaiting_user_approval
  5. pending_clinic_confirmation
  6. confirmed

  Failures go to `failed_needs_help`. Once confirmed, reminders are created automatically for the evening before and one hour before.
- **Two-phase approvals** for clinic calls, slot approval, asking family to call, and sending a memory.
- **Memory Corner.** A family member shares a photo, Nami drafts the story from Meera's own words, and it is sent only with her yes.
- **Caregiver guards.** Family cannot accept before they've been asked. Only the current owner can report an outcome.

### 3.3 Verifiers (`lib/verify/`)

These are plain code, with no LLM involved.

- `slot.ts` checks that the clinic is approved, that a quote is present, that the slot parses and isn't in the past, that it falls in the date range and time window, that the weekday matches the date, that it exists in the clinic calendar (simulated mode), and that it matches the slot Meera approved.
- `affirmation.ts` checks that a "yes" appears in **the user's own transcribed words**, in English, Hindi or Hinglish, and that no negation is present.
- `disclosure.ts` checks that the agent didn't say a phone number, date of birth, Aadhaar-like number, email or a forbidden detail on the call.
- `crisis.ts` matches explicit crisis or fall phrases and opens the help flow even if the AI misses them.

### 3.4 Agents (`lib/agents/`) and calls (`lib/calls/`)

- **Nami's voice agent** prompt and its **13 tools**. Every tool is validated with zod and runs only through the engine.
- **Caller agent**, **Clinic simulator** (fed from a deterministic calendar), **Family alert** and **Extractor** (quoted facts, structured output), all on Claude Opus 5.5 with refusal fallback.
- **Scripted fallback** when there's no API key. It is labelled "scripted".
- **Outbox dispatcher**, **simulated-call runner** (transcript streams live), **Twilio Say/Gather loop**, voicemail detection, signed webhooks, and a **restart watchdog** that marks interrupted calls failed so they are never confirmed.
- **Phone allow-list:** real calls go only to numbers in `PHONE_ALLOWLIST`.

### 3.5 API (`app/api/`)

| Route | Purpose |
|---|---|
| `/try` | Creates a new sandbox. Also `?clinic=…`, `?next=/console`, `?video=1&key=…` (real-call household) |
| `/api/state` | Snapshot for the screens |
| `/api/heartbeat` | Device-availability heartbeat |
| `/api/command` | All button actions |
| `/api/tools/[name]` | Voice tool bridge |
| `/api/voice/session` | Short-lived voice key, with caps |
| `/api/chat` | Text mode |
| `/api/safety` | Crisis-phrase net |
| `/api/demo/skip` · `/api/demo/reset` · `/api/demo/scenario` | Demo clock and sandbox controls |
| `/api/care/[token]/state` · `/action` · `/memory` | Caregiver view, actions and photo upload |
| `/api/uploads/[name]` | Serves uploaded photos |
| `/api/calls/[id]` | Call transcript and state |
| `/api/twilio/voice` · `/gather` · `/status` | Twilio webhooks |

### 3.6 Screens

- **`/app`**, Meera's companion:
  - Nami in a lake scene, live captions, approval, reminder and check-in cards, and a help banner showing truthful progress.
  - The live call transcript, My Day, Appointments with the verifier checklist, Memory Corner, and the activity feed.
  - Demo controls: a QR code that makes your phone "Arjun", a selector for clinic behaviour, a "Book Dr. Mehta" quick action, and reset.
  - Hindi and English toggle. Keyboard shortcuts: Space to talk, H for help, M to mute.
- **`/care/[token]`**, the caregiver phone page: the evidence list, I'll check / I can't / I spoke with her / still needs help, notices, shared reminders, appointments, and Memory Corner upload.
- **`/console`**, for judges: the "LLMs propose, code disposes" hero, a live agent graph, the audit timeline, the call viewer (facts, disclosure check, verifier checks), eval results, and caregiver QR codes.
- **`/mascot-lab`**: a gallery of every Nami pose with a lip-sync test.
- **`/`** landing page: work in progress (see §1).

### 3.7 Tests and evals

| Command | What it does | Result |
|---|---|---|
| `pnpm test` / `pnpm eval:engine` | Engine and verifier tests, including the 15 required acceptance checks, multi-household call IDs, caregiver guards and a 3-day randomised simulation | **28/28** |
| `pnpm eval:calls` | Simulated clinic calls | Scripted mode: **0 false confirmations, 0 disclosure violations**, 5/5. The LLM run is pending a key |
| `pnpm eval:intents` | 60 English, Hindi and Hinglish utterances including safety cases | Pending an Anthropic key |
| `pnpm eval:publish` | Writes `public/eval-results.json`, shown on `/console` | Always generated from machine-written result files, never typed by hand |

**Smoke tests on a real Postgres:**
- `scripts/smoke.ts` runs the full booking flow, then the check-in escalation.
- `scripts/smoke-multi.ts` runs two households at once, each getting its own calls.

### 3.8 Bugs found and fixed

1. **Call IDs collided across households,** so only the first demo household's calls were dispatched. This would have broken judging with many `/try` sandboxes. Fixed and regression-tested.
2. **Nami kept waving forever in dev mode** because of how React StrictMode runs effects twice. Fixed.
3. **A demo skip made an open page look closed.** The heartbeat now carries across the skipped time.
4. **The clinic was always told "follow-up"** even when another reason was asked for. Fixed.

---

## 4. What's simulated, and labelled as such

- **The clinic** in judge sandboxes is an AI receptionist with a deterministic calendar, labelled "Simulated clinic".
- **The clock** is labelled "Demo time" and can be skipped forward.
- **The phone fallback to Meera** is "not configured" in sandboxes. Real calls happen only in the `video` household, to allow-listed teammates.
- **The Memory Corner photo** in the seed is an illustration, labelled as such.

---

## 5. Known gaps and next steps

1. Finish the landing page (in progress), then review the screenshots.
2. Once keys arrive, run:
   - the Hindi voice bake-off;
   - `pnpm eval:intents` and `pnpm eval:calls` (LLM mode);
   - `pnpm eval:publish`;
   - a real Twilio call test.
3. Deploy to the VM, then smoke-test the live HTTPS link from a phone.
4. Add the README links (live demo and video) and the team's interview and survey evidence.
5. Optional: a Gemini Live voice adapter, if Hindi quality is better or OpenAI credits are short.
6. Record the video Monday 10:00–12:00, then submit the forms (every member) by 13:30.

---

## 6. Needed from the team lead

| # | Item | Why |
|---|---|---|
| 1 | `OPENAI_API_KEY` (or say "Gemini only") | Live voice in the browser |
| 2 | `ANTHROPIC_API_KEY` | Caller, Clinic simulator, Extractor, text chat, intent eval |
| 3 | Twilio Account SID, Auth Token and US number, plus two teammates' phones verified in Twilio | Real calls for the video |
| 4 | VM access (IP or SSH, OS) and a domain (the `.xyz` perk, or `<ip>.sslip.io`) | Live link over HTTPS |
| 5 | Real interview quotes and survey results | 15 points for problem evidence. We must not invent these |
| 6 | Team name (in capitals) and member names and roles | Form and README |
