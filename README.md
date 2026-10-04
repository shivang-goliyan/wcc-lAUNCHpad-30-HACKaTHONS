# Nami Care 🦦

**A gentle AI companion for parents who live alone. She talks in Hindi or English, phones the clinic for you (with your OK), and makes sure a real person follows up when something's wrong.**

> *Most AI companions try to be the friend. Nami is the one who makes sure the real friends, family and doctor show up.*

**Live demo:** `https://<your-domain>/try` (no sign-up: you get a private demo household as "Meera ji")
**Demo video:** `<link>`
**Agent console** (how it works, live): `https://<your-domain>/console`

---

## The problem

- **About 1 in 4 Indian elders have no child at home**: 5.7% live alone and 20.3% live only with a spouse or others (LASI Wave 1).
- **Depression is 8.3% when measured but 0.8% when diagnosed**, so most of the need is invisible (LASI).
- **48%** have a limitation in instrumental daily tasks such as managing medicines and appointments (LASI).
- **Only 41%** own a smartphone, and 13% use the internet (HelpAge India 2025, urban, n = 5,798).
- Today, when Mummy doesn't pick up, the family's "system" is calling a neighbour.

Our own interviews and survey results are in [`research/`](research/). Full sources: [`research/connection-research.md`](research/connection-research.md).

## What Nami does

| Job | What happens | Human in control |
|---|---|---|
| **Reminds** | Medicine, water and walk reminders, spoken and on screen | She records *what Meera says* ("you said you took it"). She never claims a pill was taken. |
| **Books the doctor** | "अगले हफ्ते डॉक्टर मेहता से सुबह का अपॉइंटमेंट बुक कर दो" ("book me a morning appointment with Dr. Mehta next week"). Nami reads the request back, **phones the clinic**, negotiates a slot and returns with it | Two approvals: permission to call, and approval of the exact slot. It is **confirmed only after the clinic confirms**. |
| **Checks in** | A daily check-in. If there's no answer, the agreed ladder runs: ask again → phone → Arjun (son) → Priya (daughter) | A contact must **accept** responsibility. Voicemail is never an acknowledgement. Nobody is ever marked "safe" automatically. |
| **Gets help** | A big red button, or "मदद" ("help"). The ladder starts immediately, 112 is always visible, and "pressed by mistake" cancels it | Progress is shown truthfully: contacting → accepted → "human-reported: …" |

## Why it's different

- **It acts in the real world.** It phones clinics and family, using Twilio for real calls, rather than only chatting.
- **LLMs propose, code disposes.** No LLM can change a care state. A deterministic workflow engine owns every state machine, and deterministic verifiers check every LLM claim:
  - the offered slot must be in range, in the requested time window, on a weekday matching its date, and actually present in the clinic's calendar;
  - the user's "yes" must appear in **her own transcribed words**;
  - the call transcript must contain no data beyond what she permitted.
- **Failures are shown honestly:**
  - "Nobody has accepted yet" is never displayed as success;
  - a successful call start is never treated as a booking;
  - a closed browser tab shows "delivery uncertain", never "she's unwell".
- **Accessible without voice:** every action has a big button and a keyboard shortcut, there are captions, and Hindi or English with one tap.

## Architecture

```
Browser ──WebRTC──► Realtime voice model (gpt-realtime-2.1) — Nami's voice & tool calls
   │  tool calls (zod-validated)                 ▲ short-lived key from /api/voice/session
   ▼
Next.js API ──► Workflow engine (pure TS state machines; the ONLY writer of care state)
   │                 │  transactional outbox (idempotency keys)
   │                 ▼
   │           Worker ──► Caller agent (Claude) ⇄ Clinic: AI simulator (judges) | real phone (Twilio)
   │                          └► Extractor (Claude, quoted facts) ─► Verifier (deterministic) ─► Engine
   │           Worker ──► Family alert: caregiver link / QR, plus a Twilio call for allow-listed numbers
   ▼
Postgres (household document locked FOR UPDATE per command; events; outbox; call transcripts)
```

| Component | Where |
|---|---|
| Engine (reminders, check-in/help ladder, appointments, pending approvals) | [`lib/engine/engine.ts`](lib/engine/engine.ts) |
| Verifiers | [`lib/verify/`](lib/verify) |
| Agents and prompts | [`lib/agents/`](lib/agents); the source of truth is [`docs/AGENTS.md`](docs/AGENTS.md) |
| Calls (sim runner, Twilio Say/Gather loop, outbox dispatcher, restart watchdog) | [`lib/calls/runtime.ts`](lib/calls/runtime.ts) |
| Mascot (hand-built layered SVG rig, 14 poses, lip-sync to her own voice) | [`components/nami/`](components/nami) |

## Reliability and evaluation

| Suite | What | Result |
|---|---|---|
| `pnpm test` | 28 engine and verifier tests: the 15 required acceptance checks (duplicate acks, restart recovery, voicemail ≠ acceptance, duplicate webhooks, user responds mid-escalation, nobody accepts → unresolved…) plus a 3-day randomised simulation with invariants | **28/28** |
| `pnpm eval:intents` | 60 utterances (20 English, 20 Hindi, 20 Hinglish), including safety cases (dose questions, crisis words, an unapproved hospital) → does Nami pick the right tool? | *(run with keys)* |
| `pnpm eval:calls` | Simulated clinic calls across 5 receptionist behaviours → **false confirmations** and **disclosure violations** | scripted: 0 / 0 *(LLM run pending)* |

## Responsible design

- Nami says she is an AI.
- There is no diagnosis, no dosing advice and no health score.
- Every consequential action is two-phase (propose → confirm), and confirmation is checked against the user's own words.
- The caregiver link is scoped to one contact and expires in 48 h. Contacts see only what Meera agreed to share; transcripts are never shared.
- No raw audio is stored. Memories are saved only with spoken consent and can be deleted.
- Cost and abuse guards protect the public demo: voice session caps, per-IP limits, a daily budget, kill switches, and real calls only to allow-listed numbers.
- **What's simulated in the public demo:** the clinic is an AI receptionist with a deterministic calendar, labelled "Simulated clinic". The clock is a labelled "Demo time" that you can skip forward. Real phone calls are shown in the video.

## Run it

```bash
pnpm install
# Postgres: docker compose up -d db   (or any local Postgres; set DATABASE_URL)
pnpm dev          # web on :3000
pnpm worker       # engine ticks + call dispatcher
pnpm test         # engine acceptance tests
```

**Deploy** (VM): `cp .env.example .env`, fill it in, then `docker compose up -d --build`. Caddy gives you HTTPS automatically.

Without API keys the app still runs. The simulated clinic switches to a scripted dialogue (labelled), and every action works through the buttons.

## Docs

[`docs/PRD.md`](docs/PRD.md) · [`docs/TRD.md`](docs/TRD.md) · [`docs/AGENTS.md`](docs/AGENTS.md) · [`docs/DESIGN.md`](docs/DESIGN.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md) · [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md)

*Built for WCC Launchpad 30 (Agentic AI track). All personas and phone numbers in the demo are fictional or belong to consenting teammates.*
