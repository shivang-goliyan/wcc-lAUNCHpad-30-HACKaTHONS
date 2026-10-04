# Nami Care — Product Requirements (PRD)

**Version:** 1.0 · 4 Oct 2026, 16:00 IST
**Status:** Locked for build. Change it only through `DECISIONS.md`.
**Event:** WCC Launchpad 30, Agentic AI track. Submission closes **Mon 5 Oct, 14:00 IST**.
**Source docs:** `docs/source/` holds the Codex workflow and mascot specs. This PRD adapts them to a **website**; the deviations are listed in `DECISIONS.md`.

---

## 1. The idea in four lines

Nami is a friendly otter who lives on a web page and talks with older people living alone, in English, Hindi or Hinglish.
She reminds them about their medicines and asks how their day went. When they say "book my doctor for next week", **she actually phones the clinic, finds a slot, and asks them before she confirms it.**
If they don't answer a check-in, she follows an agreed ladder: she tries them again, then calls their son, then a backup contact. Someone has to *accept* responsibility; nothing is marked "safe" until a human says so.
Her job is to keep people connected to *real* people (family, doctor, neighbour), not to replace them.

## 2. Problem and evidence

| Fact | Source |
|---|---|
| India's 60+ population is 138M (2021) and will be 194M by 2031 | NSO via ThePrint |
| 5.7% of elders live alone and 20.3% live with a spouse or others only, so **about 1 in 4 have no child at home** | LASI Wave 1 |
| **Depression is 8.3% when measured but 0.8% when diagnosed**, so most of the need is invisible | LASI Wave 1 |
| 48% have a limitation in instrumental daily tasks, which includes managing medicines and appointments | LASI Wave 1 |
| 36% have a child who has migrated; empty nesters report more depression | SSM Pop Health 2023 ⚠ abstract only |
| Polypharmacy affects 49% | PMC meta-analysis |
| Only **41% own a smartphone and 13% use the internet** (urban, n=5,798) | HelpAge India 2025 |
| Elders with no social participation have **2.44× the odds** of a daily-living limitation | BMC Public Health 2023 |
| 42% of young Indians who use AI to cope say they are now less likely to approach friends or family | YKA × YLAC 2025 |

All links are in `research/connection-research.md`.

**Design consequence:** the elder must not need to type or navigate. Voice is the main route, but there are always big buttons too. Success is measured by **completed real-world outcomes**: a reminder acknowledged, an appointment confirmed, a family member who accepts responsibility. Minutes spent chatting are not success.

**Evidence the team must collect tonight.** This is worth 15 points, so do not invent any of it.
- Run a 5-minute call with at least one older adult and one adult child who lives away from a parent. Aim for three of each, which can include your own grandparents or parents.
- Ask about missed medicines, the hassle of booking appointments, and "what happens today when Mummy doesn't pick up?"
- Send a 6-question Google Form to friends who have parents living alone (template in `BUILD-PLAN.md` §6).
- Record quotes with permission and use only real numbers.

## 3. Users

| Role | Persona in the demo data | Can do | Cannot |
|---|---|---|---|
| **Care recipient (user)** | Meera Sharma, 72, retired Hindi teacher, lives alone in Jaipur, speaks Hindi and some English | Talk, acknowledge reminders, ask for help, approve appointments, see and delete memories, change sharing | — |
| **Primary contact** | Arjun (son, Bengaluru) | Receive approved alerts, accept or decline follow-up, report the outcome | See private conversations unless Meera shares them |
| **Backup contact** | Priya (daughter, Pune) | Same as the primary contact | Same as the primary contact |
| **Clinic** | Dr. Mehta Clinic, Malviya Nagar | Tell Nami what's available and confirm a slot | Receive more than the permitted fields |
| **Nami (AI)** | — | Explain, remind, call approved numbers, record outcomes | Diagnose, change medication, claim to be the patient or a human, mark anyone "safe" |

## 4. How we're different from what already exists

| Existing product | What it does | What Nami does differently |
|---|---|---|
| ElliQ (US) | A hardware companion with reminders and a caregiver app | Web-based (no hardware), Hindi-first, and **takes real-world actions** such as calling the clinic |
| Saathi AI, JunoDost (India) | Voice check-ins, reminders and family updates | **An escalation ladder that requires human acceptance**, and agentic appointment booking with approval |
| Emoha, Samarth, Anvayaa | Paid human care desks in metros | Automated and always on, and it hands off to the family's own people |
| 410+ "elderly companion" GitHub repos | Chatbots plus reminders | **Evidence-linked states.** No state says "confirmed" or "safe" without proof, and that is enforced by a deterministic workflow engine, not the LLM |

**The positioning line:** *"Most AI companions try to be the friend. Nami is the one who makes sure the real friends, family and doctor show up."*

## 5. Goals and non-goals

**Goals for the submission**
1. A judge can open the live link and, with no walkthrough, talk to Nami in Hindi or English. They can watch her book an appointment and act as the caregiver from their own phone by scanning a QR code.
2. Every consequential action has a human approval gate and a visible audit trail.
3. Failures are shown truthfully: a call with no answer, voicemail, an unclear slot, or nobody accepting responsibility.
4. The mascot is delightful: she moves, reacts to state and lip-syncs to her own voice.

**Non-goals**
- No diagnosis, no medication advice, no checks on whether a pill was swallowed, and no fall detection.
- No sleep inference.
- No automatic calls to emergency services. We show 112 clearly instead.
- No payments, insurance or legal work.
- No native desktop or Electron app for this submission. The website is the product (see `DECISIONS.md` D1).
- No cloning of a relative's voice.

## 6. Scope

**P0** must ship. **P1** ships if P0 is green by 06:00 Monday. **P2** is out.

| ID | Feature | Priority |
|---|---|---|
| F0 | **Landing website.** Nami roams the page with animation and a hero button says "Talk to Nami" | P0 |
| F1 | **Live conversation.** Voice in and out in en/hi/Hinglish, captions, interruption, a text box and buttons with the same functions | P0 |
| F2 | **My Day and reminders.** One medication schedule and one water/walk reminder, each occurrence with explicit outcomes | P0 |
| F3 | **Appointment agent.** Request → permission → call the clinic (simulated, or a real phone) → deterministic verification → user approval → confirmation → reminder created and shared | P0 |
| F4 | **Routine check-in and escalation ladder** with caregiver acceptance | P0 |
| F5 | **Get Help (SOS).** Immediate ladder, truthful progress and 112 always visible | P0 |
| F6 | **Caregiver view.** Mobile web, opened by QR code or a scoped link; actions are accept, decline, "I spoke with her" and "still needs help" | P0 |
| F7 | **Agent activity and audit timeline.** A visible record of every step, its evidence and why it happened | P0 |
| F8 | **Demo clock and judge sandbox.** Each visitor gets an isolated seeded household and a labelled "skip ahead" control | P0 |
| F9 | **Care agreement and settings.** Contacts, sharing toggles, quiet hours, text size, reduced motion and language | P0 (seeded and editable, not a long wizard) |
| F10 | **Memory Corner.** A family photo → Nami invites a story → Meera reviews it → it's sent to family as a text summary and audio | P1 |
| F11 | **Memory control.** "What Nami remembers about me" with delete and export | P1 |
| F12 | **Single-switch scanning mode** (one key cycles focus, another selects) | P1 |
| F13 | **Real phone calls through Bolna** to verified team numbers (for the video) | P1 (the simulated clinic is P0) |
| F14 | Wake word ("Nami") | P2 |
| F15 | Electron floating desktop window, WhatsApp, more languages | P2 |

## 7. Requirements and acceptance criteria

### F0 Landing website
- The hero shows Nami sitting by a lake, matching the concept art. She blinks and breathes, her eyes follow the cursor, and she waves once on load.
- As the visitor scrolls, Nami **moves between sections**: she swims along a wave divider, peeks from the edges and points at each feature card.
- The **"Talk to Nami"** button starts a live voice session on the landing page itself, with no sign-up.
- The **"Try the full demo as Meera"** button creates a sandbox household and opens `/app`.
- The sections are, in order:
  1. Problem with data.
  2. What Nami does (four jobs).
  3. How she stays honest (state ladder).
  4. For families.
  5. Live agent console preview.
  6. Team.
- It renders well at 360 px wide, and reduced-motion mode replaces the movement with static poses.

### F1 Conversation
- **Language.** Nami replies in the language the user speaks: Hindi, English or Hinglish. A visible EN/हिं toggle sets the UI language and her preferred reply language.
- **Captions.** Live captions are always shown for both sides.
- **Interruption.** If the user talks while Nami is speaking, her audio stops within 300 ms and her mouth closes. The cancelled turn's tools must not run.
- **Tools.** Nami acts only through server-validated tools (`AGENTS.md` §3). An unclear request with consequences, such as booking or contacting someone, gets a clarifying question; it is never a silent guess.
- **Equivalent controls.** Talk, My Day, Call Family, Get Help and Mute are normal buttons outside the mascot canvas. Everything voice can do, buttons or text can also do.
- **AI disclosure.** Nami says she is an AI in her first greeting and whenever asked.
- **"Stop", "Not now" and "Leave me alone"** are accepted gracefully, with no guilt-tripping or sad face.
- **Cost cap.** A voice session lasts at most 5 minutes, then falls back to text with a polite notice.

### F2 Reminders
- Each scheduled reminder creates a single **occurrence** with a unique ID.
- The outcomes are:
  - `taken_reported`
  - `not_taken_reported`
  - `snoozed`
  - `help_requested`
  - `unacknowledged`
  - `delivery_uncertain`
- Acknowledging twice gives one outcome. The duplicate is logged and ignored.
- Snoozing reschedules the *notification only*, not the prescription.
- "Not taken" offers to contact the agreed helper. It never advises on dosing.
- The UI says **"You said you took it"**, never "Taken ✓ verified".

### F3 Appointment agent (the main agentic flow)
1. Meera says *"अगले हफ्ते डॉक्टर मेहता से अपॉइंटमेंट बुक कर दो, सुबह का टाइम"* ("book an appointment with Dr. Mehta next week, a morning time").
2. Nami reads back the clinic, the date range, the preferred time and what she will share (name and reason "follow-up"). She asks permission to call.
3. When permission is given, the **Caller agent** contacts the clinic and the transcript streams live in the activity panel.
   - **Simulated mode** (default, judges): the clinic receptionist is an AI agent backed by a deterministic calendar. It is labelled "Simulated clinic".
   - **Phone mode** (video): a real call is placed to a teammate playing the receptionist.
4. The **Verifier** (plain code, not an LLM) checks the slot offered by the extractor:
   - it falls inside the permitted date range and preferred window;
   - the clinic is approved;
   - there is no duplicate request ID;
   - date, weekday and time are consistent;
   - in simulated mode, the slot exists in the clinic calendar.
   - If any check fails, the state becomes `failed_needs_help` with the reason shown.
5. Nami presents the exact slot with weekday, date and time, then asks **"Should I confirm?"** with Yes/No buttons as well as voice.
6. On Yes, the clinic confirms. The state becomes `confirmed` only after a clinic confirmation event is recorded; a successful call start is never treated as confirmation.
7. A reminder is created automatically for the day before and for 1 hour before. Arjun sees the appointment if sharing allows it.
8. **Failures shown truthfully:**
   - busy line;
   - no answer;
   - voicemail;
   - no slot in range ("They only have Thursday evening. Want me to ask for the week after?");
   - unclear extraction.

### F4 Check-in ladder

The agreed policy in the demo data is:
1. The check-in is due at 10:00.
2. The response window is 15 minutes.
3. Nami retries once on the page.
4. She calls Meera's phone (simulated in sandbox mode).
5. At the 30-minute deadline she escalates to Arjun.
6. If Arjun declines or there is no acceptance within 10 minutes, she escalates to Priya.
7. If nobody accepts, the case is `unresolved` and shown in red.

Requirements:
- The evidence panel shows facts such as "Desktop last seen 09:58", "Not quiet hours" and "No planned absence". It never says "she may have fallen".
- Only an explicit acceptance through the caregiver link, or a voice "yes" with the transcript quote stored as evidence, counts as acceptance. Voicemail and connected-but-silent calls do not.
- If Meera responds mid-escalation, pending attempts are cancelled and the contact who accepted is told "Meera responded at 10:41".
- There is one case ID throughout, so late callbacks cannot reopen or duplicate the case.

### F5 Get Help
- A big red button, the spoken word "help / मदद", or a keyboard shortcut starts the help case **immediately**. There are no routine retries and no long countdown.
- An "I pressed it by mistake" control is available for 10 seconds. It does not block the action; it cancels and notifies the contact.
- 112 is always visible: "If this is an emergency, call 112."
- Progress is shown truthfully:
  - contacting Arjun;
  - no answer;
  - Arjun accepted at 14:02, follow-up in progress;
  - Arjun reported "spoke with her, she is fine" at 14:09.
- If every route is exhausted, a prominent "Nobody has accepted yet" message is shown. Exhausting retries is never shown as success.

### F6 Caregiver view
- It opens from a QR code on the app screen, or from an emailed or SMS'd link that is signed and scoped to one household and one contact and expires after 24 h.
- It shows only what is authorised: open cases, last explicit response, device availability, shared reminder reports and appointment status. There is **no health score**.
- Actions:
  - "I'll check now" → accepted.
  - "I can't" → next contact.
  - "I spoke with her" → human-reported outcome, with a note.
  - "Still needs help" → keeps the case active and moves to the next route.
- If several people respond, the current owner and the acknowledgement history are shown.

### F7 Agent activity and audit
- A collapsible right-hand panel in `/app` and a full page at `/console`.
- Each step shows: actor (Conversation agent, Caller agent, Extractor, Verifier, Workflow engine, Human), action, input summary, evidence and result.
- A "Why?" link explains each automated action using the agreement rule that triggered it.

### F8 Demo clock and sandbox
- `/try` creates a fresh household (Meera, Arjun, Priya, the clinic, schedules) and stores its ID in a cookie. Sandboxes expire after 48 h.
- The demo clock reads "Demo time 09:58 · ⏩ Skip to next event". It is labelled and never hidden. Skipping fires real engine ticks.
- In the sandbox, the visitor can put their own name and phone/email on the "Arjun" contact. Real calls happen only to allow-listed verified numbers; for everyone else the QR/link is the channel.

### F10 Memory Corner (P1)
1. Arjun uploads a photo with a prompt such as "Ask Ma about our Shimla trip, 1998" from the caregiver view.
2. Nami shows the photo and invites the story.
3. Meera talks. Nami drafts a short summary and keeps the audio clip only if Meera agrees.
4. Meera previews the draft, then chooses "Send to Arjun" or "Keep private". It is never sent automatically.
5. Arjun's view shows the story.

This is the "connection, not replacement" proof.

## 8. Accessibility (non-negotiable)

| Requirement | Detail |
|---|---|
| Target size | At least 56 px; base text 20 px, scalable to 28 px; WCAG AA contrast |
| Keyboard | Visible focus. Space = Talk (push-to-talk), H = Get Help, M = Mute, D = My Day |
| Motion | Reduced-motion mode shows static poses with status text |
| Captions | Always available; never voice-only |
| Status | Every state has a text label outside the canvas, with `aria-live` regions |
| Timing | Tolerant response windows and nothing timed that the user must beat |

## 9. The 3-minute demo video (story)

| Time | Beat |
|---|---|
| 0:00–0:20 | **Hook.** A real quote from our interviews, plus "1 in 4 Indian elders have no child at home." Arjun's phone rings in Bengaluru. |
| 0:20–0:45 | **Meet Nami.** The landing page: Nami swims in, waves, and greets Meera in Hindi. |
| 0:45–1:05 | **Reminder.** "Meera ji, BP ki dawai ka time." / "Haan le li." Then the outcome is shown: "You said you took it." |
| 1:05–1:55 | **The wow.** "Doctor Mehta se appointment book kar do."<br>• Nami reads the request back, asks permission and **phones the clinic** (a real phone rings on camera).<br>• The transcript streams in Hindi.<br>• The Verifier ticks its checks.<br>• "Thursday 8 Oct, 10:30. Confirm?" "Haan." Confirmed, and the reminder is created. |
| 1:55–2:35 | **Safety net.** ⏩ The demo clock skips. The check-in gets no answer. The evidence panel appears, then the ladder starts.<br>• Arjun's phone rings.<br>• He taps "I'll check now" on the caregiver page.<br>• Meera's screen shows "Arjun is checking on you."<br>• Arjun reports "spoke with her". |
| 2:35–2:50 | **Trust.** The audit timeline, "Nami never marks anyone safe", the same flow done with buttons only, and the eval pass rate. |
| 2:50–3:00 | **Close.** "Nami doesn't replace family. She makes sure they show up." Then the live link. |

## 10. How we score on each rubric criterion

| Criterion | Points | Our evidence |
|---|---|---|
| User insight and problem evidence | 15 | LASI, HelpAge and NSO data, **plus our own interviews and survey** (tonight) |
| Strength of core solution | 24 | Three completed real-world outcomes: reminder, booked appointment, human handoff |
| Technical depth and reliability | 24 | Multi-agent work (Conversation, Caller, Clinic sim, Extractor, Verifier), a deterministic workflow engine, idempotency, an outbox, provider-callback dedupe, an eval harness with a published pass rate, and restart recovery |
| Originality | 15 | An agent that **phones the clinic in Hindi** and an escalation ladder that **requires human acceptance**; not a chat companion |
| Real-world usability | 12 | The judge's own phone becomes the caregiver through a QR code, plus voice or buttons, Hindi, big targets and no sign-up |
| Responsible design and trust | 10 | Approval gates, evidence-linked states, AI disclosure, data minimisation, 112 visibility, memory control, and no clinical claims |

## 11. Metrics we report

These come from controlled tests and the eval harness, not real-world claims.
- Workflow-engine scenario pass rate: the 10 Codex acceptance checks plus our own. **Target: 100%.**
- Intent and tool-routing accuracy on 60 utterances (20 English, 20 Hindi, 20 Hinglish). **Target: ≥ 90%.**
- Slot-extraction accuracy over N simulated clinic calls. **Target: ≥ 95%,** and 0 false confirmations.
- Median time from escalation to human acceptance in the demo.
- Unassisted task completion by interviewed users, if we manage to test with them tonight.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Voice latency or outage during judging | A text fallback that uses the same tools; a recorded demo labelled "recorded" |
| Judges run up the API bill | Per-session caps, per-IP rate limits, a daily budget kill switch and the simulated clinic by default |
| Mascot assets late | A pose-PNG fallback; the app works with a static Nami (`DESIGN.md` §5) |
| Hindi speech recognition errors | Read back every consequential detail and add button confirmation |
| Trial telephony limited to verified numbers | Use real calls in the video only; judges use the simulated clinic and the QR caregiver flow |
