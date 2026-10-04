# Nami Care — Technical Requirements (TRD)

**Version:** 1.0, 4 Oct 2026
**Reads with:** `PRD.md` (what), `AGENTS.md` (prompts, tools, eval), `DESIGN.md` (UI and mascot), `DECISIONS.md` (why).

**Golden rule: LLMs propose, code disposes.** No LLM output changes a care state directly. Every state change goes through the deterministic workflow engine (`lib/engine`). That engine checks permissions, the state-machine transition and the evidence before it writes anything.

---

## 1. Architecture

```
 Browser (Next.js client)                          Vercel (Next.js server)                      External
 ┌──────────────────────────────┐   ephemeral   ┌───────────────────────────────┐
 │ Landing  /   (Nami roams)    │◄──token───────│ /api/voice/session            │──────► Realtime voice model
 │ App      /app (Meera)        │               │   caps, rate limits, prompt   │        (WebRTC direct from browser)
 │  ├ NamiStage (Rive|poses)    │◄─WebRTC audio─┼───────────────────────────────┼──────►
 │  ├ Realtime client + lipsync │               │                               │
 │  ├ Tool bridge ──────────────┼──POST────────►│ /api/tools/:name  (zod+perm)  │
 │  ├ My Day / Help / Approvals │──POST────────►│ /api/* commands               │
 │  └ Activity panel            │◄──poll 1.5s───│ /api/state  (snapshot)        │
 │ Care     /care/[token] (phone)│◄─poll 2s─────│ /api/care/[token]/*           │
 │ Console  /console            │               │                               │
 └──────────────────────────────┘               │  lib/engine  (pure, no IO)    │
                                                │  lib/agents  (caller, sim     │──────► LLM (text, structured)
                                                │     clinic, extractor)        │
                                                │  lib/verify  (deterministic)  │
                                                │  outbox dispatcher ───────────┼──────► Calling: Sim | Bolna
                                                │  /api/webhooks/bolna ◄────────┼─────── call results
                                                │  /api/cron/tick ◄─────────────┼─────── QStash (every minute)
                                                └──────────────┬────────────────┘
                                                               │ Postgres (Supabase)
                                                               ▼
                                     households, care_recipients, contacts, consents, clinics,
                                     reminder_schedules/occurrences, cases, contact_attempts,
                                     appointment_requests, call_sessions, memories, events, outbox
```

## 2. Stack

These are locked unless `DECISIONS.md` says otherwise.

| Layer | Choice |
|---|---|
| App | Next.js (App Router), TypeScript strict, pnpm |
| UI | Tailwind CSS v4, `motion` (Framer Motion), Radix primitives, `lucide-react` icons |
| Mascot | `@rive-app/react-canvas` if a `.riv` is delivered; otherwise a layered PNG/SVG rig animated with `motion` (`DESIGN.md` §5) |
| i18n | Simple dictionary: `lib/i18n/{en,hi}.ts`; fonts Noto Sans + Noto Sans Devanagari |
| Data | Supabase Postgres, Drizzle ORM, `postgres` driver (`prepare: false` for the pooler) |
| Storage | Supabase Storage (Memory Corner photos and audio) — P1 |
| Scheduling | Upstash QStash schedule → `/api/cron/tick` every minute, plus client ticks while the app is open, plus demo skip |
| Live updates | SWR polling (1.5 s app, 2 s caregiver). No websockets, which keeps things robust on Vercel. |
| Voice | Realtime speech-to-speech in the browser behind a `VoiceAdapter`: OpenAI `gpt-realtime-2.1` (WebRTC) **or** Gemini `gemini-3.8-live` (WebSocket). The Hindi bake-off at 17:30 picks one (`DECISIONS.md` D3). |
| Text LLM | Claude via the Anthropic SDK (`@anthropic-ai/sdk`): `claude-sonnet-5-5` for the caller, sim clinic, extractor and text-mode chat; `claude-haiku-4-5-20251001` for bulk eval and summaries. Output is constrained by tool schemas and validated with zod (D4). |
| Phone | `CallingAdapter` with `sim` (default) and `bolna` (real +91 calls to allow-listed numbers) |
| Email | Resend (caregiver link). Needs a verified domain (D7). |
| Auth | Sandbox household = signed httpOnly cookie. Caregiver = HMAC-signed scoped token (`jose`). Admin = env password for `/console?admin`. |
| Validation | `zod` on every API input, tool argument and LLM structured output |
| Tests | `vitest` (engine + verifier), `eval/` runner scripts |
| Deploy | Vercel (production branch `main`), custom `.xyz` domain |

## 3. Repository layout

```
app/
  page.tsx                      # landing (F0)
  try/route.ts                  # GET → create sandbox household → 303 /app
  app/page.tsx                  # Meera's companion (F1–F5, F7)
  care/[token]/page.tsx         # caregiver mobile view (F6)
  console/page.tsx              # agent console + audit + eval results (F7)
  settings/page.tsx             # care agreement & preferences (F9)
  api/
    state/route.ts              heartbeat/route.ts        tick/route.ts
    cron/tick/route.ts          demo/skip/route.ts        demo/reset/route.ts
    voice/session/route.ts      voice/session/[id]/end/route.ts
    tools/[name]/route.ts       chat/route.ts
    reminders/[id]/outcome/route.ts
    checkin/respond/route.ts    help/route.ts             help/[caseId]/mistake/route.ts
    appointments/route.ts       appointments/[id]/permit/route.ts   appointments/[id]/approve/route.ts
    calls/[id]/route.ts         webhooks/bolna/route.ts
    care/[token]/state/route.ts care/[token]/action/route.ts  care/[token]/memory/route.ts
    settings/route.ts
components/
  nami/            NamiStage.tsx, useNamiState.ts, lipsync.ts, rigs/{RiveRig,PoseRig}.tsx, RoamingNami.tsx
  app/             TalkButton, MyDay, HelpPanel, ApprovalCard, ActivityPanel, Captions, DemoClock, CaregiverQR
  ui/
lib/
  engine/          types.ts, reminder.ts, checkin.ts, help.ts, appointment.ts, tick.ts, commands.ts, policy.ts
  verify/          slot.ts, affirmation.ts, disclosure.ts
  agents/          prompts/*.md, tools.ts (zod schemas), caller.ts, clinicSim.ts, extractor.ts, memory.ts
  adapters/        calling/{index,sim,bolna}.ts, voice/{index,<provider>}.ts, email.ts
  db/              schema.ts, client.ts, repo.ts (load snapshot / persist result in one tx)
  outbox.ts  clock.ts  ids.ts  auth.ts  limits.ts  seed.ts  i18n/
eval/
  engine.scenarios.test.ts   intents.json   intents.run.ts   calls.run.ts   results/
public/nami/                 # mascot assets (DESIGN.md §4)
docs/
```

## 4. Data model

The source of truth is `lib/db/schema.ts`. Rules for every table:
- every row has `household_id`;
- IDs are `text` with prefixes (`hh_`, `occ_`, `case_`, `apt_`, `call_`, `att_`, `ev_`, `ob_`);
- domain times are **virtual time** (§6) stored as `timestamptz`;
- `created_at` is real time.

| Table | Key columns |
|---|---|
| `households` | `id`, `kind` (`sandbox` / `video`), `clock_offset_ms bigint`, `next_wake_at`, `phone_calls_enabled bool`, `expires_at`, `version int` |
| `care_recipients` | `household_id` PK, `display_name`, `address_as` ("Meera ji"), `language` (`hi` / `en` / `auto`), `timezone` ("Asia/Kolkata"), `quiet_start`, `quiet_end`, `planned_absence_until`, `text_scale`, `reduced_motion`, `captions`, `phone_e164` |
| `contacts` | `id`, `name`, `relation`, `priority` (1 = primary, 2 = backup), `phone_e164`, `email`, `verified_at`, `participation_confirmed_at`, `permissions jsonb` {checkins, help, appointments, reminders, memories} |
| `consents` | `id`, `purpose` (`automated_contact_calls` / `clinic_calls` / `appointment_booking` / `share_reminders` / `share_appointments` / `share_checkins` / `memory_retention`), `contact_id` null, `fields jsonb`, `granted_at`, `revoked_at` |
| `clinics` | `id`, `name`, `name_hi`, `phone_e164`, `mode` (`sim` / `phone`), `approved bool`, `permitted_disclosure jsonb` (e.g. `["first_name","reason"]`), `sim_calendar jsonb` (slots and their state) |
| `reminder_schedules` | `id`, `kind` (`medication` / `water` / `walk` / `appointment`), `label`, `label_hi`, `instructions` (as checked by a human), `times text[]`, `active`, `appointment_id` null |
| `reminder_occurrences` | `id`, `schedule_id`, `due_at`, `notify_at`, `state` (§5.1), `outcome`, `outcome_at`, `outcome_source` (`voice` / `button` / `keyboard` / `switch`), `outcome_quote`, `delivery jsonb` {attempted_at, page_visible, device_last_seen}. **UNIQUE(schedule_id, due_at)** |
| `checkin_policy` | `household_id` PK, `times text[]`, `response_window_min`, `page_retries`, `phone_fallback bool`, `deadline_min`, `contact_ack_timeout_min` |
| `cases` | `id`, `type` (`checkin` / `help`), `state` (§5.2), `opened_at`, `deadline_at`, `step int`, `owner_contact_id`, `evidence jsonb`, `resolution`, `resolved_at`, `version`. **Partial UNIQUE(household_id, type) WHERE state not terminal** |
| `contact_attempts` | `id`, `case_id`, `contact_id` (null if the recipient), `channel` (`page` / `phone` / `link` / `email`), `state`, `call_id`, `outcome`, `evidence jsonb`, `idempotency_key UNIQUE`, `timeout_at` |
| `appointment_requests` | `id`, `clinic_id`, `state` (§5.3), `constraints jsonb` {date_from, date_to, window, reason}, `disclosure jsonb`, `request_key UNIQUE`, `offered_slot jsonb`, `verification jsonb` [{check, pass, detail}], `approved_at`, `approval_quote`, `confirmed_at`, `confirmation_evidence jsonb`, `failure_reason`, `version` |
| `call_sessions` | `id`, `purpose` (`clinic_availability` / `clinic_confirm` / `contact_alert` / `recipient_checkin`), `adapter` (`sim` / `bolna`), `provider_call_id UNIQUE`, `state` (`queued` / `ringing` / `in_progress` / `completed` / `no_answer` / `busy` / `voicemail` / `failed`), `transcript jsonb` [{speaker, text, lang, t}], `extracted jsonb`, `raw jsonb`, `started_at`, `ended_at`, `related_id` |
| `pending_actions` | `id`, `kind` (`permit_clinic_call` / `approve_slot` / `call_family` / `send_memory`), `payload`, `state` (`open` / `confirmed` / `declined` / `expired`), `expires_at`, `turn_id` |
| `memories` | `id`, `kind` (`preference` / `story`), `text`, `source_quote`, `consented_at`, `deleted_at` |
| `memory_prompts` (P1) | `id`, `from_contact_id`, `photo_path`, `prompt`, `state` (`new` / `story_recorded` / `awaiting_review` / `sent` / `kept_private`), `story_text`, `audio_path`, `sent_at` |
| `device_status` | `household_id` PK, `last_seen_at`, `visibility`, `last_explicit_response_at` |
| `events` | `id`, `at_virtual`, `at_real`, `category` (`agent` / `state` / `external` / `human`), `actor`, `action`, `record_type`, `record_id`, `summary`, `summary_hi`, `detail jsonb`, `correlation_id` |
| `outbox` | `id`, `kind` (`place_call` / `cancel_call` / `send_email` / `run_sim_call`), `payload`, `idempotency_key UNIQUE`, `state` (`pending` / `in_flight` / `done` / `failed` / `cancelled`), `attempts`, `next_attempt_at`, `last_error` |
| `voice_sessions` | `id`, `ip_hash`, `started_at`, `ended_at`, `seconds` (for caps) |

## 5. State machines

The engine owns all of these. Anything not listed in a table is rejected and logged as `event(category=state, action=transition_rejected)`.

### 5.1 Reminder occurrence

| From | Event | To | Side effects |
|---|---|---|---|
| `scheduled` | tick at or after `notify_at` | `awaiting_response` | Record delivery evidence and notify the UI (card plus spoken prompt if the page is visible) |
| `awaiting_response` | user `taken` | `resolved` (outcome `taken_reported`) | Nod animation; share with Arjun if `share_reminders` is on |
| `awaiting_response` | user `not_taken` | `resolved` (`not_taken_reported`) | Offer to contact the helper (a pending action) |
| `awaiting_response` | user `snooze(n)` | `scheduled` (`notify_at += n`) | Increment the snooze count. `due_at` is unchanged. |
| `awaiting_response` | user `help` | `resolved` (`help_requested`) | Open the help flow (§5.2) |
| `awaiting_response` | tick past `notify_at + window` and the page was visible | `resolved` (`unacknowledged`) | None (not an emergency) |
| `awaiting_response` | tick past the window and the page was **not** visible or seen recently | `resolved` (`delivery_uncertain`) | Show device status |
| `resolved` | any user outcome | `resolved` | **No-op.** Log `duplicate_ack_ignored`. |

### 5.2 Case (check-in and help share one machine; help starts at `escalating`)

The states are:
- `awaiting_response`
- `retrying_page`
- `phone_fallback`
- `escalating`
- `owner_accepted`
- terminal: `resolved_user_responded`, `resolved_human_reported`, `cancelled_mistake`, `unresolved`

| From | Event | To | Side effects |
|---|---|---|---|
| — | tick at check-in time, outside quiet hours and planned absence | `awaiting_response` | Show the check-in card (Main hoon / Baad mein / Madad chahiye) |
| — | tick at check-in time **inside** quiet hours or planned absence | none | Event `checkin_skipped(policy)` |
| — | user Get Help / explicit help intent | `escalating` (step = contact priority 1) | Outbox `place_call`/`send_email` to the primary contact |
| `awaiting_response` | window expired | `retrying_page` | Re-prompt (up to `page_retries`) |
| `retrying_page` | retries exhausted and `phone_fallback` | `phone_fallback` | Outbox `place_call(recipient_checkin)` |
| `phone_fallback` | call outcome `no_answer`, `voicemail`, `failed`, or `deadline_at` reached | `escalating` (step 1) | Write the evidence snapshot and contact the primary |
| `escalating` | contact **accepts** (link or voice yes with quote) | `owner_accepted` | `owner_contact_id`; notify the recipient UI ("Arjun is checking on you") |
| `escalating` | contact declines, `ack_timeout`, voicemail, no answer | `escalating` (step + 1) | Contact the next priority. If there is none → `unresolved`. |
| `owner_accepted` | contact reports "spoke with her" or "visited" | `resolved_human_reported` | Store the note as human-reported (source and time) |
| `owner_accepted` | contact reports "still needs help" | `escalating` (step + 1) | Contact the next route; keep the owner in the history |
| any non-terminal | **user responds** (button / voice / phone) | `resolved_user_responded` | **Cancel pending outbox calls**; tell the accepted or active contact "Meera responded at hh:mm" |
| `escalating` (help, within 10 s) | user "pressed by mistake" | `cancelled_mistake` | Cancel the outbox; notify any contact already reached |
| `unresolved` | contact accepts later | `owner_accepted` | Allowed. A late acceptance is still useful. |

**Invariants**, all tested:
- At most one open case per type per household.
- A provider callback for an attempt on a terminal case changes nothing.
- Voicemail or "connected" never counts as acceptance.
- No state or UI text says "safe", "fine" or "well". Only the phrase "human-reported: …" is used.

### 5.3 Appointment request

| From | Event | To |
|---|---|---|
| — | `propose_appointment` tool | `draft` → readback → pending action `permit_clinic_call` |
| `draft` | user confirms (affirmation verified, §7.3) | `finding_availability` → outbox `run_sim_call` or `place_call(clinic_availability)` |
| `finding_availability` | call completed → extractor → **slot verifier passes** | `awaiting_user_approval` (pending action `approve_slot`) |
| `finding_availability` | no slot in range / verifier fails / call failed after `max_retries` (2) | `failed_needs_help` (reason) — Nami offers alternatives |
| `awaiting_user_approval` | user approves (affirmation verified) | `pending_clinic_confirmation` → outbox confirm call |
| `awaiting_user_approval` | user declines | `cancelled` |
| `pending_clinic_confirmation` | extractor `confirmed=true` with quote, and slot equals the approved slot | `confirmed` → create reminder schedules (day before 18:00, 1 h before) and share if allowed |
| `pending_clinic_confirmation` | slot gone / unclear / call failed | `failed_needs_help` |

`request_key = hash(household, clinic, date_from, date_to, window)`. A duplicate propose returns the existing open request.

## 6. Time, clock and scheduling

- `now(h) = Date.now() + h.clock_offset_ms`. All engine logic takes `now` as a parameter, so it never calls `Date.now()` directly.
- **Demo skip** (`POST /api/demo/skip`) sets the offset so that `now = next_wake_at − 3 s`, waits for that moment, then ticks. The UI always shows "Demo time" with a ⏩ badge.
- **Tick sources:**
  1. QStash schedule every minute → `/api/cron/tick` (signature verified). This processes households where `next_wake_at <= now(h)`, at most 50 per run.
  2. The open `/app` posts `/api/heartbeat` every 10 s, which also ticks that household.
  3. Demo skip.
- **The tick is idempotent.** Running it twice at the same `now` produces no new effects.
- Times are stored in UTC and rendered in `care_recipients.timezone`. Spoken dates always include the weekday ("Thursday, 8 October, 10:30 in the morning").

## 7. Engine, persistence and effects

### 7.1 Engine contract (pure)
```ts
type Snapshot = { household, recipient, contacts, consents, policy, occurrences, cases, attempts, appointments, pendingActions, device };
type Command  = { type: 'reminder.respond' | 'checkin.respond' | 'help.open' | 'help.mistake' | 'case.contactAction'
                       | 'appointment.propose' | 'pending.confirm' | 'pending.decline' | 'call.result' | ...; actor: Actor; payload; idempotencyKey };
type Result   = { mutations: Mutation[]; effects: OutboxItem[]; events: EventRow[]; reply?: ToolReply };
decide(snapshot, command, now): Result      // throws EngineReject{code, message} on invalid transition / missing permission
tick(snapshot, now): Result
```

### 7.2 Persistence: one transaction per command
1. `SELECT … FROM households WHERE id = $1 FOR UPDATE`. This serialises everything per household.
2. Load the snapshot, then run `decide` or `tick`.
3. Apply the mutations, insert the events, and insert the outbox items using `ON CONFLICT (idempotency_key) DO NOTHING`.
4. Recompute `next_wake_at`.
5. Commit. **Success is shown in the UI only after the commit returns.**

The outbox dispatcher runs right after the commit in the same request (`after()`) and on every tick. It claims items with `FOR UPDATE SKIP LOCKED`, retries with backoff up to 3 times, then records `failed` and feeds a `call.result{failed}` command back to the engine.

### 7.3 Deterministic verifiers (`lib/verify`)

| Verifier | What it checks |
|---|---|
| `slot.ts` | The offered slot parses to an ISO date-time. It falls within `date_from..date_to` and the time window (morning 08–12, afternoon 12–16, evening 16–20). It is not in the past. The weekday stated in the transcript matches the date. The clinic is approved. In sim mode, the slot exists and is free in `sim_calendar`. **Output:** a check list stored on the request and shown in the UI. |
| `affirmation.ts` | Confirmation needs either a UI button press or the **latest final user transcript** matching an affirmation lexicon: haan / ha / ji / ji haan / theek hai / kar do / confirm / yes / yeah / ok / sure / हाँ / जी / ठीक है / कर दो. A negation lexicon (nahi / mat / no / don't / नहीं / मत) also must not match. The model's own claim of consent is never enough. |
| `disclosure.ts` | Scans caller-agent turns for any data that wasn't permitted: phone numbers, dates of birth, addresses, Aadhaar-like 12-digit numbers, medication names unless `reason` allows them. A violation is logged and flags the eval. |

## 8. API surface

Every input is validated with zod. The household comes from the signed cookie, and the caregiver from the token.

| Method and path | Purpose |
|---|---|
| `GET /try` | Create a seeded sandbox (`lib/seed.ts`), set the `hh` cookie, then 303 to `/app` |
| `GET /api/state` | The snapshot DTO for the UI: recipient, today, open case with attempts, appointments, active call transcript, pending actions, last 50 events, demo clock |
| `POST /api/heartbeat` | `{visibility}`. Updates `device_status` and ticks. |
| `POST /api/demo/skip` · `POST /api/demo/reset` | Demo clock skip; reset the sandbox to seed |
| `POST /api/voice/session` | Enforces caps (§10), then returns `{clientSecret, model, expiresAt, sessionId, instructions, tools}` |
| `POST /api/voice/session/:id/end` | Records seconds used |
| `POST /api/tools/:name` | `{turnId, args, lastUserTranscript}`. Validated → `decide` → returns a short tool result for the model, including `say_hint` |
| `POST /api/chat` | Text mode. Same tools, run server-side in a loop, max 4 tool calls per turn. |
| `POST /api/reminders/:id/outcome` | `{outcome, source, idempotencyKey}` (buttons) |
| `POST /api/checkin/respond` · `POST /api/help` · `POST /api/help/:caseId/mistake` | Buttons and keyboard |
| `POST /api/appointments/:id/permit` · `POST /api/appointments/:id/approve` | `{decision: yes or no, source}` (button path) |
| `GET /api/calls/:id` | Transcript and state, for live streaming by polling |
| `POST /api/webhooks/bolna` | Bolna does not sign webhooks, so verify the custom header `x-nami-secret` (set in the agent's Extractions tab) and optionally the source IPs (13.203.39.153, 13.126.9.249, 13.202.133.53). Upsert `call_sessions` by `execution_id`. Bolna POSTs on every status change; only `completed`, `busy`, `no-answer`, `failed` and `balance-low` are terminal (`call-disconnected` arrives first with an empty extraction, so ignore it). Terminal → extractor → `call.result` command |
| `GET /api/care/:token/state` · `POST /api/care/:token/action` | `{caseId, action: accept / decline / spoke / still_needs_help, note}` |
| `POST /api/care/:token/memory` (P1) | Photo upload and prompt |
| `POST /api/settings` | Preferences, contacts, sharing toggles (writes consent rows) |

## 9. Voice and tool bridge (browser)

1. The client calls `/api/voice/session`. The server builds the session config:
   - the instructions are Nami's prompt (`AGENTS.md` §2) plus a **context block**: today's virtual date and weekday, a 14-day date table, the recipient's name and language, today's open items, and the open pending actions;
   - the tools are `AGENTS.md` §3;
   - it also sets the voice, input transcription, and server VAD with interruption.
   It mints a short-lived client secret.
2. The client connects directly to the provider through `lib/adapters/voice`: OpenAI over WebRTC via `@openai/agents/realtime` (`RealtimeAgent`, `RealtimeSession`, `OpenAIRealtimeWebRTC({audioElement})`), or Gemini over WebSocket via `@google/genai` `live.connect` with an ephemeral token. Output audio goes to a playing `<audio>` element (OpenAI) or our own AudioContext (Gemini PCM), **and** to an `AnalyserNode` that feeds `lipsync.ts` (`DESIGN.md` §6). Chrome quirk: a remote WebRTC stream reads as silence in Web Audio unless it is also attached to a playing `<audio>` element, so resume the AudioContext on the Talk click.
3. Event handling:
   - Input transcription events update the captions and `lastUserTranscript`.
   - A function call becomes `POST /api/tools/:name` carrying the `turnId`. The result is sent back as a function output and a new response is requested.
   - If the user starts speaking during playback, the client stops and flushes the audio, sets `mouthOpen = 0`, marks the current `turnId` as cancelled, and ignores any later tool calls carrying the old `turnId`.
4. **Consequential tools are two-phase.**
   - `propose_*` creates a `pending_action` and returns a readback.
   - Only `confirm_pending_action` (which the server checks with `affirmation.ts`) or the UI button executes it.
5. **Fallback.** If WebRTC fails or the voice cap is reached, the same UI switches to text mode (`/api/chat`). Nami speaks through the browser's `speechSynthesis` (`hi-IN` or `en-IN` voice where available), and captions are always on.

## 10. Calling adapters

```ts
interface CallingAdapter {
  start(req: { callId; purpose; to: E164 | 'sim'; script: CallerBrief; lang: 'hi'|'en' }): Promise<{ providerCallId }>;
  cancel(providerCallId): Promise<void>;
  // results arrive via webhook (bolna) or are written directly as the sim dialogue progresses
}
```

### `sim` adapter (default; all judge sandboxes)
- `run_sim_call` executes in `after()` and runs up to 12 turns of dialogue between the **Caller agent** and the **Clinic simulator** (`AGENTS.md` §4–5).
- The clinic simulator answers only from `sim_calendar` through a `lookup_slots(date_from, date_to, window)` tool, and can hold or confirm a slot through `hold_slot` / `confirm_slot`.
- Each turn is appended to `call_sessions.transcript` so the UI streams it.
- A sandbox scenario knob (`?clinic=busy|evening_only|voicemail|cooperative`) drives failure demos and the eval.

### `bolna` adapter (real phone calls; P1, for the video)
- `POST https://api.bolna.ai/call` with `{agent_id, recipient_phone_number, user_data}` and a Bearer API key.
- There are two Bolna agents:
  - **Nami Clinic Caller** (Hindi/English) handles availability, then confirmation.
  - **Nami Family Alert** informs the contact and asks for an explicit yes or no.
- Results arrive at our webhook. If no terminal webhook has arrived after 4 min, the tick polls `GET https://api.bolna.ai/executions/{execution_id}` (fields: `status`, `transcript`, `extracted_data`, `answered_by_voice_mail`, `telephony_data.hangup_reason`, `telephony_data.recording_url`). `answered_by_voice_mail = true` means outcome `voicemail`, never acknowledgement.
- Trial: $5 credit, **verified numbers only** (User Profile → Verified Numbers), 2 concurrent calls, shared +91 caller ID, about 6¢/min. Bolna's own `extracted_data` is informational only; **our extractor and verifier are authoritative**.
- Transcript → extractor → the same verifier path as sim.
- **Only numbers in `PHONE_ALLOWLIST` can be dialled.** Everything else is refused in code.

## 11. Security, privacy and cost limits

- Provider keys are server-only. The browser gets only short-lived voice client secrets.
- Household isolation: every query is filtered by `household_id` from the signed cookie, and a contact token is scoped to `{hh, contactId, exp ≤ 48h}`.
- **Prompt-injection posture.** Clinic and contact speech is **data**. The extractor output is zod-validated and verifier-checked. Nothing a callee says can call a tool or widen what can be disclosed.
- **Data minimisation.** By default no raw audio is stored; only transcripts of agent calls (needed as evidence) and structured outcomes are kept. Memory Corner audio is stored only on explicit consent. Notification and email copy is minimal ("Meera's check-in needs a response — open link").
- **Crisis safety.** A deterministic keyword list (en/hi) runs on user transcripts. On a match, the help panel opens (showing 112, Tele-MANAS 14416 and "Call Arjun"); Nami must not continue as if nothing happened.
- **Limits** (env-configurable):

  | Setting | Default |
  |---|---|
  | `VOICE_MAX_SESSION_SEC` | 300 |
  | `VOICE_SESSIONS_PER_IP_PER_HOUR` | 4 |
  | `VOICE_DAILY_MINUTES_CAP` | 600 |
  | `SIM_CALLS_PER_HOUSEHOLD_PER_HOUR` | 6 |
  | `KILL_SWITCH_VOICE` | — |
  | `KILL_SWITCH_LLM` | — |

  When a cap is hit, the UI degrades to text mode or to the recorded clip with a labelled message.

## 12. Environment variables

```
DATABASE_URL=                 # Supabase pooled
SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY=     # storage (P1)
VOICE_PROVIDER=openai|gemini   OPENAI_API_KEY=   GEMINI_API_KEY=
VOICE_MODEL=gpt-realtime-2.1 | gpt-realtime-2.1-mini | gemini-3.8-live   VOICE_NAME=
ANTHROPIC_API_KEY=            # text agents (D4)
LLM_MODEL=claude-sonnet-5-5   LLM_FAST_MODEL=claude-haiku-4-5-20251001
BOLNA_API_KEY=   BOLNA_CLINIC_AGENT_ID=   BOLNA_ALERT_AGENT_ID=   BOLNA_WEBHOOK_SECRET=
PHONE_ALLOWLIST=+91XXXXXXXXXX,+91YYYYYYYYYY
QSTASH_CURRENT_SIGNING_KEY=   QSTASH_NEXT_SIGNING_KEY=
RESEND_API_KEY=  EMAIL_FROM=
APP_URL=  COOKIE_SECRET=  CONTACT_TOKEN_SECRET=  ADMIN_PASSWORD=
VOICE_MAX_SESSION_SEC=300  VOICE_SESSIONS_PER_IP_PER_HOUR=4  VOICE_DAILY_MINUTES_CAP=600
KILL_SWITCH_VOICE=false  KILL_SWITCH_LLM=false
```

## 13. Testing and evaluation

The details are in `AGENTS.md` §8. Results are written to `eval/results/` and shown on `/console` and in the README.

- `pnpm test`: engine and verifier unit tests, including **every acceptance check** below.
- `pnpm eval:intents`: 60 utterances across en/hi/Hinglish → the text-mode agent → checks the tool name and key arguments.
- `pnpm eval:calls`: N simulated clinic calls across scenarios → slot accuracy, **false confirmations (must be 0)** and **disclosure violations (must be 0)**.

**Required acceptance tests** (Codex §9 plus ours):

| # | Test | Expected |
|---|---|---|
| 1 | User acknowledges a reminder twice | One outcome; a `duplicate_ack_ignored` event |
| 2 | Process "restarts" (snapshot reloaded from the DB mid-flow) | State survives; no repeated completed effect |
| 3 | Heartbeat stops | Device "unavailable"; no wellbeing claim in any text |
| 4 | Quiet hours or planned absence | Check-in skipped with an event; no retries |
| 5 | Contact call → voicemail | Case stays `escalating`, then moves to the next contact |
| 6 | Backup accepts | `owner_accepted` with the backup as owner; awaits an outcome |
| 7 | User responds during escalation | Pending outbox cancelled; the accepted contact notified |
| 8 | Duplicate provider webhook | One transition |
| 9 | Clinic call fails | `failed_needs_help`; never `confirmed` |
| 10 | Unclear speech / non-affirmative transcript on confirm | Rejected; Nami asks again or shows buttons |
| 11 | Slot outside the range or window | Verifier fails → `failed_needs_help` with a reason |
| 12 | Duplicate appointment proposal | Returns the existing request |
| 13 | Nobody accepts | `unresolved` shown; never success |
| 14 | Help "pressed by mistake" | `cancelled_mistake`; reached contacts notified |
| 15 | Tick run twice at the same `now` | No new effects |

## 14. Deployment

1. Create the Vercel project from the GitHub repo (public). Production = `main`. Feature work happens on branches, merging to `main` via PR.
2. Run the Supabase migration with `drizzle-kit push`. The seed runs per sandbox via `/try`, and a `video` household is seeded by script for recording.
3. Create a QStash schedule: `* * * * *` → `https://<domain>/api/cron/tick`.
4. Set the Bolna agent webhook to `https://<domain>/api/webhooks/bolna` with the header `x-nami-secret`, and add the teammates' phones as Verified Numbers.
5. **Smoke test** after each deploy:
   1. `/try` → talk → reminder ack.
   2. Book through the sim clinic → approve → confirmed.
   3. Skip → check-in escalation → caregiver QR accept → resolve.
