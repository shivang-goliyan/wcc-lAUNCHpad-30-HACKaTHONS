# Raynet 🦦 · meet Nami

**A gentle AI companion for parents who live alone. She talks in Hindi or English, phones the clinic for you (with your OK), and makes sure a real person follows up when something's wrong.**

> *Nami keeps them company. Raynet makes sure someone shows up.*
>
> *Most AI companions try to be the friend. Nami is the one who makes sure the real friends, family and doctor show up.*

**Live demo:** **https://raynet.in/try** (no sign-up: you get a private demo household as "Meera ji")
**Demo video:** `<link>`
**Agent console** (how it works, live): **https://raynet.in/console**

---

## The problem

- **India's 60+ population grows from 149 million (2022) to 347 million by 2050** (UNFPA India Ageing Report 2023).
- **About 1 in 4 Indian elders have no child at home**: 5.7% live alone and 20.3% live only with a spouse or others (LASI Wave 1). 36% of older parents have at least one child who migrated (LASI analysis, n = 19,401).
- **Depression is 8.3% when measured but 0.8% when diagnosed**, so most of the need is invisible (LASI).
- **48%** have difficulty with at least one instrumental daily task, a list that explicitly includes *making phone calls* and *taking medicines* (LASI).
- **41%** of elders on long-term medicines take them poorly, and forgetting is the top reason (Cureus 2026, Gujarat, n = 380).
- Follow-up works when someone does it: missed hypertension visits fell from 66% to 22% with health-worker follow-up (BMJ Open Quality 2025, all ages).
- **Only 41%** own a smartphone, and 13% use the internet (HelpAge India 2025, urban, n = 5,798).
- Today, when Mummy doesn't pick up, the family's "system" is calling a neighbour.

Every number above is verified against its source, with the exact quote, year and sample size, in [`research/evidence-2026.md`](research/evidence-2026.md). Apps for Hindi check-ins and reminders already exist; what nobody does is the **follow-through**: phoning the clinic for her, and an escalation that only closes when a person accepts it.

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
Browser ── mic ──► Deepgram Nova-3 (Hindi + English mixed; 60 s token from /api/stt/token)
   │  her words ─► /api/safety: phrase net, then the Jev crisis classifier ─► help case if needed
   │  her words ─► Nami (text agent, 13 zod-validated tools) ─► /api/tts (Fish Audio) ─► her voice + lip-sync
   │               (OpenAI realtime voice is used instead when its key is set)
   ▼
Next.js API ──► Workflow engine (pure TS state machines; the ONLY writer of care state)
   │                 │  transactional outbox (idempotency keys)
   │                 ▼
   │           Worker ──► Caller agent ⇄ Clinic: AI simulator (judges) | real phone (Twilio)
   │                          └► Extractor (quoted facts) ─► Verifier (deterministic) ─► Engine
   │           Worker ──► Family alert: caregiver link / QR, plus a Twilio call for allow-listed numbers
   ▼
Postgres (household document locked FOR UPDATE per command; events; outbox; call transcripts)
```

The text agents run on any OpenAI-compatible model or on Anthropic (`LLM_PROVIDER`); the public demo uses Gemini Flash-Lite, rotating across keys and failing over on rate limits or hung requests, with a scripted fallback so a booking never breaks.

| Component | Where |
|---|---|
| Engine (reminders, check-in/help ladder, appointments, pending approvals) | [`lib/engine/engine.ts`](lib/engine/engine.ts) |
| Verifiers (slot, consent, disclosure, crisis phrases, crisis classifier decision) | [`lib/verify/`](lib/verify) |
| Agents and prompts | [`lib/agents/`](lib/agents); the source of truth is [`docs/AGENTS.md`](docs/AGENTS.md) |
| Calls (sim runner, Twilio Say/Gather loop, outbox dispatcher, restart watchdog) | [`lib/calls/runtime.ts`](lib/calls/runtime.ts) |
| Voice loop (Deepgram listening, Fish speaking, browser fallbacks) | [`lib/client/cascade.ts`](lib/client/cascade.ts) |
| Nami: painted to match the concept art; 30 Wan 2.2 motion clips (sit, stand, walk, wave, call, sleep…) played as stacked-alpha video through WebGL | [`components/nami/`](components/nami), pipeline in [`design/nami-art/`](design/nami-art) |

## Reliability and evaluation

| Suite | What | Result |
|---|---|---|
| `pnpm eval:engine` | 28 engine and verifier tests: the 15 required acceptance checks (duplicate acks, restart recovery, voicemail ≠ acceptance, duplicate webhooks, user responds mid-escalation, nobody accepts → unresolved…) plus a 3-day randomised simulation with invariants | **28/28** |
| `pnpm eval:calls` | 30 simulated clinic calls, 6 per receptionist behaviour, with the live caller, clinic simulator and extractor | **0 false confirmations, 0 disclosure violations**; the right slot in 18/18 calls that had one; nothing booked in all 12 that didn't. When a clinic demanded her mobile number and date of birth, Nami refused and ended the call. |
| `pnpm eval:intents` | 60 utterances (20 English, 20 Hindi, 20 Hinglish), including safety cases (dose questions, crisis words, an unapproved hospital): does Nami pick the right tool first? | **54/60** on Gemini Flash-Lite (en 17, hi 19, Hinglish 18; safety 10/12). The two safety misses are crisis lines answered kindly without the tool call; both are caught by the phrase net, which opens the help case regardless. |

Numbers are written by the eval scripts and published to `/console` from those files; nobody types them.

## Responsible design

- Nami says she is an AI.
- Two crisis layers that don't depend on the chat model: a deterministic phrase net (English, Hindi, Hinglish), then a typed classifier (TypeSafe Jev, ~0.4 s) that catches paraphrases like "kya fayda hai ab jeene ka" and ignores "the medicine fell". Either one opens a help case with 112 and Tele-MANAS 14416 on screen.
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

**Deploy** (VM): `scripts/deploy.sh user@host raynet.in` syncs the code, writes the VM's `.env` from your local keys (secrets generated on the VM), runs `docker compose up -d --build` behind Caddy (automatic HTTPS) and waits for the site to answer.

Without API keys the app still runs. The simulated clinic switches to a scripted dialogue (labelled), and every action works through the buttons.

## Docs

[`docs/PRD.md`](docs/PRD.md) · [`docs/TRD.md`](docs/TRD.md) · [`docs/AGENTS.md`](docs/AGENTS.md) · [`docs/DESIGN.md`](docs/DESIGN.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md) · [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md)

*Built for WCC Launchpad 30 (Agentic AI track). All personas and phone numbers in the demo are fictional or belong to consenting teammates.*
