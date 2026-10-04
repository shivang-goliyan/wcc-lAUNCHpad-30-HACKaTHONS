# Nami Care

## Product workflow and implementation blueprint

**Version 1.0 | 4 October 2026 | WCC hackathon build specification**

Nami is a voice-accessible desktop companion that helps a person follow daily routines, maintain human connections, arrange appointments, and reach a trusted contact when support is needed.

**Primary user:** an older adult living apart from family, with a nominated care contact and the ability to use at least one supported input method. The same core interface supports people with limited hand movement or difficulty typing.

**Product promise:** a calm, familiar presence with useful actions and visible outcomes. Reduced loneliness is a goal to evaluate. This prototype does not diagnose illness, verify medication ingestion, detect unconsciousness, or provide continuous medical monitoring.

**Main journey:** consent and setup; daily conversation; reminders and activities; appointment coordination; agreed check-ins; human handoff when necessary.

**Companion document:** Nami-Care-Mascot-Generation-and-Animation.md explains the character, asset prompts, animation, voice synchronisation, and desktop presentation. Its PDF includes the visual reference boards.

The product artwork in the PDF is a concept mockup. It is not evidence that the interface or integrations have been implemented.

<!-- pagebreak -->

## 1. Scope, users, and success

The first release should complete a small set of reliable workflows. Reminders, calls, and conversation share one user profile and one event history.

| Role | Can do | Boundaries |
| --- | --- | --- |
| User | Talk, acknowledge reminders, request help, approve appointments, inspect memory, change sharing | Retains control of everyday choices and private conversations |
| Trusted contact | Receive approved alerts, acknowledge follow-up, assist with setup | Sees only information the user has authorised |
| Clinic staff | Provide appointment availability and confirmation | Receives only the information needed for the request |
| Nami | Explain, schedule, call approved destinations, record outcomes | Acts within configured permissions and workflow rules |

**Build now:** desktop companion; voice and accessible buttons; one checked medication schedule; one recurring check-in; caregiver acknowledgement; appointment call with approval; a small caregiver web view.

**Add after the core works:** family photos and approved voice notes; more languages; single-switch scanning; configurable hobbies and memory activities; broader desktop assistance.

**Research separately:** wearable sleep integrations, fall detection, clinical risk scores, and emergency dispatch integrations. These require their own data, validation, and operational arrangements. Computer inactivity is not a sleep measurement.

### Evidence to collect before the pitch

- Speak with at least one intended user and one caregiver; aim for three of each if accessible. Ask for concrete examples of missed routines and difficult coordination.
- Observe whether the user can activate Nami, understand a reminder, request help, and correct a misunderstood request without coaching.
- Ask what information the user wants shared, with whom, and in which situations. Do not assume that family access includes conversation transcripts.
- Record feedback and permission to use anonymised observations. Do not invent interview results or medical benefits.

### Measures

Measure unassisted task completion, recognition corrections, reminder acknowledgement, appointment outcome accuracy, unnecessary contact attempts, and time to human acknowledgement in controlled tests. Count connection attempts separately from completed conversations. Evaluate whether the user finds Nami welcome; session length alone does not demonstrate reduced loneliness.

<!-- pagebreak -->

## 2. Onboarding and the care agreement

**Entry:** the user opens Nami for the first time, optionally with a helper. **Exit:** preferences and permissions are saved, contacts are confirmed, and a test interaction succeeds.

1. Introduce Nami as an AI companion. Ask how to address the person, which language to use, and whether speech, buttons, keyboard, or a switch is easiest.
2. Configure text size, captions, speaking speed, volume, response time, reduced motion, quiet hours, and a visible mute control.
3. Ask which reminders are wanted. Enter medication names and schedules from checked instructions; require human review of anything extracted from a photo or document.
4. Nominate a primary trusted contact and backup. Verify phone details and have each contact confirm participation through their own contact channel.
5. Define routine check-in times, the response window, permitted retries, fallback channels, contact order, and what happens when nobody is reachable. These are personalised settings, not a universal medical protocol.
6. Record explicit permission for automated calls under that agreement. Separate this from permission to book appointments or share conversation memories.
7. Run a clearly labelled test reminder and a test contact acknowledgement. Explain device availability and the phone fallback.

### Minimum settings

| Setting | Example design choice |
| --- | --- |
| Time handling | Store an IANA timezone, local schedule, and UTC event timestamps; show the user's local time |
| Routine reminders | User-selected occasions and wording; quiet-hours behaviour |
| Check-in agreement | Scheduled window, follow-up deadline, retry limits, approved contacts |
| Sharing | Separate toggles for reminder reports, appointments, check-ins, and selected messages |
| Absence | A planned-away interval with an explicit end time |
| Clinic permission | Approved clinic number, permitted dates, and information that may be disclosed |

### Information control

The user can inspect, correct, export, or delete saved preferences and memories. Revoking a contact's permission stops future sharing with that contact. Changes to an active help case are logged and communicated clearly; the interface must not silently abandon a case already handed to someone.

Avoid storing raw audio by default. Record structured outcomes and the minimum evidence needed to explain an action. Keep sensitive details out of lock-screen notifications and voicemail messages.

<!-- pagebreak -->

## 3. Daily routine and reminder workflow

Nami remains quietly available and initiates interaction only at agreed times. A morning greeting offers the day's next useful items; the user can hear the full schedule or dismiss it.

**Example:** "Good morning, Meera. Would you like to hear today's plan?" A response such as "Later" changes the interaction schedule; it is not a failure or reason for a welfare alert.

### Reminder sequence

1. The scheduler creates one reminder occurrence with a unique ID and due time.
2. The application presents a labelled card and, if enabled, a spoken prompt. It records whether delivery was actually attempted and whether the device was reachable.
3. The user responds through voice or accessible controls. Low-confidence speech is clarified before saving a consequential answer.
4. Nami repeats the saved outcome briefly. A request for support starts the appropriate help workflow.
5. Any repeat follows the user's configuration. Medication-specific escalation follows the existing care agreement; a missed dose is not automatically treated as an emergency.

| Response or condition | Saved outcome | Next action |
| --- | --- | --- |
| "I took it" | User-reported taken | Acknowledge; stop repeats for that occurrence |
| "I have not taken it" | User-reported not taken | Offer contact with the agreed helper; use existing instructions |
| "Remind me later" | Reminder snoozed | Reschedule the notification; do not change the prescribed schedule |
| "I need help" | Assistance requested | Ask what assistance is wanted or open the agreed help route |
| No answer | Unacknowledged | Follow the configured routine policy |
| Computer unavailable | Delivery uncertain | Show availability status; use an authorised fallback if configured |

### Additional routines

Water, meals, rest, and activity reminders use the person's preferences and existing care instructions. Do not impose a universal fluid target or generate a new exercise prescription. Sleep support can include a bedtime routine and a morning self-report; label it as self-reported.

Medication lists and reminder tools can support medicine management, but Nami must not recommend doubling doses, alter treatment, or infer ingestion from a camera or a button press. Refer medication questions to the clinician or pharmacist. [S2]

<!-- pagebreak -->

## 4. Companionship, memory, and accessibility

Nami should offer continuity and agency. It can remember interests, follow up on a story, suggest an activity, or help the user contact a person they care about. It must be clear that Nami is an AI.

### A useful companionship loop

1. Offer an activity at a welcome time: conversation, music, a photograph, reading aloud, or a short word game.
2. Ask permission before retaining a personal memory: "Would you like me to remember that you enjoy gardening?"
3. Reuse approved details sparingly and accurately. If uncertain, ask rather than inventing a shared history.
4. Offer a bridge to human connection: arrange a call, draft a message, or record a story for review.
5. Show the recipient and content before sending. Sending requires the user's action or a clearly scoped prior permission.

**Living Memory Corner:** a family member shares an approved photo; Nami invites a story; the user reviews a voice note or summary and chooses whether to send it. Do not clone a relative's voice or impersonate a person.

**Loneliness claim:** evaluate whether users feel supported and whether the system helps them maintain desired relationships. Do not advertise a cure or infer emotional health from engagement statistics. Human contact and community participation remain important. [S1]

### Accessible interaction

| Need | Required behaviour |
| --- | --- |
| Limited hand movement | Large targets, voice commands, keyboard access, optional single-switch scanning |
| Speech difficulty | Equivalent buttons, text, keyboard or switch input; tolerant response windows |
| Hearing difficulty | Captions, readable call summaries, visible reminders |
| Low vision | Scalable text, strong contrast, screen-reader labels and clear focus |
| Motion sensitivity | Reduced-motion mode with static expressions and status text |
| Fatigue or slow responses | Adjustable pacing; no unnecessary timed interaction |

Voice should be one accessible route, not the only route. W3C guidance describes both the benefits of speech input and barriers that voice-only services create. [S3, S4]

Nami uses respectful adult language. It should accept "Stop", "Not now", and "Leave me in peace" without guilt, persuasion, or a sad reaction intended to prolong engagement. A user who chooses silence has not automatically requested a welfare intervention.

<!-- pagebreak -->

## 5. Appointment calling: request to confirmation

**Entry:** "Arrange a follow-up with my usual clinic next week." **Exit:** a confirmed appointment, a pending request with its status, or a clear handoff to the user.

1. Identify the approved clinic and collect the acceptable date range, preferred times, relevant existing referral details, and information the user allows Nami to share.
2. Read back the request and obtain permission to contact the clinic. Check the user's calendar only with permission.
3. The calling agent introduces itself as an AI assistant acting for the user and asks about availability. It must not claim to be the patient or a clinician.
4. Record the offered slot, location, any stated fee, and clinic-provided preparation instructions. Treat unclear information as unresolved.
5. Present an exact option to the user. Obtain final approval before committing, unless the user previously gave a clear booking mandate covering that option.
6. Complete the clinic's supported confirmation process. If a callback is required, preserve the pending state and make the next step explicit.
7. Mark the appointment confirmed only after a clinic confirmation is received. Add reminders and share approved details with the care contact.

| Status | Meaning |
| --- | --- |
| Draft | User's request is still being clarified |
| Finding availability | Clinic contact is in progress |
| Awaiting approval | A slot is available; the user has not approved commitment |
| Pending clinic confirmation | User approved; clinic confirmation is still missing |
| Confirmed | Clinic confirmation and exact appointment details are recorded |
| Failed / needs help | Call failed, information was unclear, or a human must complete the request |

### Failure handling

Busy lines, voicemail, unavailable slots, or a failed provider API do not become confirmations. Retry only within the configured limits. A request ID prevents an accidental second booking. Read back dates with weekday, day, month, time, and timezone when necessary.

Calling provider integrations can expose call results and failure notifications. Validate provider callbacks and match them to the correct request; a successful call initiation is not an appointment outcome. [S8, S9]

**Prototype:** use a consenting test recipient acting as clinic staff and a test calendar. Label this controlled demonstration. Do not imply that a real medical appointment was booked by the demo.

<!-- pagebreak -->

## 6. Missed check-ins and human follow-up

Routine nonresponse, technical unavailability, and explicit requests for urgent help are different events. Five to seven missed prompts over several days must not be the universal emergency trigger.

### Routine check-in sequence

1. A check-in becomes due according to the agreed schedule. Show an accessible response such as "I'm here", "Later", or "I need help".
2. Wait for the person's configured response window. A permitted deferral updates that window.
3. If no response arrives, check delivery evidence, device availability, quiet hours, planned absence, and recent explicit responses. These signals provide context; none establishes the person's physical condition.
4. Try the approved alternative channel, such as a phone check-in. The deadline and channel order come from the care agreement.
5. If the check-in remains unacknowledged at the agreed deadline, create one case and contact the primary person with factual, minimal information.
6. Require acknowledgement that the person will follow up. If they decline or remain unreachable, proceed to the next approved contact.
7. Record a follow-up outcome. If nobody accepts, leave the case visibly unresolved and execute only the remaining pre-agreed actions.

| Evidence | Correct interpretation |
| --- | --- |
| No desktop response | Check-in unacknowledged |
| No app heartbeat | Device availability unknown |
| Computer asleep | Desktop interaction unavailable |
| User responds | Response received; update the specific open case |
| Caregiver accepts | Someone has accepted follow-up; wellbeing is not yet confirmed |
| Caregiver reports a visit or call | Human-reported outcome, with time and source |

**Example contact message:** "This is Nami, Meera's automated assistant. Her scheduled check-in has not been acknowledged. Her desktop is offline. Please confirm whether you can check on her."

A phone connection or voicemail is not acknowledgement. Track an explicit response from the authorised contact. Do not put sensitive details in a generic voicemail. [S9]

If the user responds during an outbound call, cancel unsent actions and update the contact with the new information. Keep one incident ID so retries and late callbacks cannot create duplicate cases or reopen a resolved one.

<!-- pagebreak -->

## 7. Explicit SOS and the caregiver view

**Trigger:** the user activates Get Help through a large button, an accessible switch, or an explicit spoken help request. An unclear phrase receives a short clarification; an explicit request does not wait for repeated routine prompts.

### Help workflow

1. Open a persistent help panel and state the action: "I am contacting your chosen person now."
2. Start the pre-agreed contact route. Keep direct contact and emergency-call options visible. Offer an accessible way to correct an accidental trigger without imposing a long countdown.
3. Display truthful progress: contacting, no answer, acknowledged, follow-up in progress, or unresolved.
4. Once a contact accepts responsibility, record who accepted and when. Obtain a later follow-up report; acknowledgement alone must not mark the user as safe.
5. If the contact does not answer, use the next approved route. If all routes fail, state the failure prominently; never display success because retries were exhausted.

India's official emergency number is 112 for medical and other emergencies. The user-facing product should make the appropriate emergency route clear. Automated emergency-service calling is a separate integration that needs verified operational support; ordinary cloud telephony must not be assumed to provide it. Use test contacts for hackathon demonstrations. [S5]

### Caregiver page

Show only authorised information: open check-in cases, last explicit response time, device availability, approved reminder reports, and appointment status. Do not create an invented health score.

| Caregiver action | System result |
| --- | --- |
| "I will check now" | Follow-up accepted; record contact and time |
| "I cannot help" | Move to the next approved contact |
| "I spoke with them" | Record a human-reported follow-up and requested next step |
| "Still needs help" | Keep the case active and follow the remaining agreed route |

Require authenticated access. A link must not expose the dashboard to unrelated recipients. If multiple people respond, show the current owner and retain the acknowledgement history.

### Availability promise

The companion is available while the device and app are running. A backend can continue agreed contact workflows when the desktop is unavailable, but it cannot observe the person. An always-powered device and an independent phone route are deployment choices to discuss with intended users, not capabilities to imply in the prototype.

<!-- pagebreak -->

## 8. Architecture and data contracts

Use the existing React interface inside Electron for desktop presentation, a separate backend for durable schedules, and the team's calling provider for authorised outbound calls. Nami's animation follows application state; it never determines a care outcome.

### Component responsibilities

| Component | Responsibility |
| --- | --- |
| Desktop shell | Mascot, accessible controls, wake-word activation, captions, local notifications, availability events |
| Conversation service | Clarify intent, explain outcomes, propose permitted tool actions |
| Workflow service | Enforce permissions, schedule events, own reminder and help-case transitions |
| Calling adapter | Initiate approved calls, receive authenticated results, expose failures |
| Caregiver web view | Present authorised updates and explicit acknowledgements |
| Database and audit history | Persist preferences, permissions, occurrences, cases, requests, and outcomes |

**Recommended technology:** React/Vite + Electron; Rive or a pose-based animation fallback; local wake-word processing; the existing speech/calling stack; Node or FastAPI backend; PostgreSQL; a durable job queue or scheduler. Choose tools already familiar to the team.

### Minimum records

- UserProfile: timezone, language, input preferences, quiet hours and approved interests.
- ConsentGrant: purpose, recipient, permitted fields, expiry or revocation time.
- CareContact: verified contact channel, order, permissions and acknowledgement identity.
- ReminderOccurrence: schedule ID, due time, delivery evidence and user-reported outcome.
- CheckInCase: deadline, evidence, assigned contact, attempt history and follow-up outcome.
- AppointmentRequest: request constraints, approvals, clinic details and confirmation evidence.
- DeviceStatus: last heartbeat and known suspend/resume events, separate from human responses.
- AuditEvent: actor, action, record ID, timestamp and result.

### Reliability rules

Use unique operation IDs, bounded retries, persistent jobs and idempotent callback processing. Authenticate tools server-side. Keep provider secrets out of the desktop renderer. Tool arguments must be schema-validated and checked against permissions before execution. Clinic conversations cannot override application permissions.

Persist acknowledgements before showing success. Retain schedule changes. Restarts and duplicate events must not repeat a completed action or create another dose record.

Wake-word processing can run locally. Electron exposes power events; platform support varies. On Ubuntu Wayland, floating-window behaviour has limitations, so test a docked-window fallback on the actual demo device. [S6, S7, S10]

<!-- pagebreak -->

## 9. Build order, verification, and demonstration

### Build in this order

1. Create the desktop shell with Talk, My Day, Get Help, mute, captions and a static mascot fallback.
2. Implement voice intent handling and equivalent accessible controls. Test interruption and unclear speech.
3. Build one persistent reminder occurrence with explicit response states and restart recovery.
4. Build one check-in case, primary/backup contact order, and authenticated acknowledgement page.
5. Connect the existing calling provider. Handle no answer, voicemail, duplicate callbacks and failed calls.
6. Add appointment availability, user approval, clinic confirmation and a test calendar entry.
7. Bind animation to real state. Add one memory activity only after the main actions work.

### Required acceptance checks

| Test | Expected result |
| --- | --- |
| User acknowledges twice | One saved occurrence outcome |
| App restarts | Previous state survives; no repeated completed action |
| Desktop disconnects | Device marked unavailable; no claim about physical wellbeing |
| Quiet hours or planned absence | Agreed policy applied without nuisance retries |
| Contact reaches voicemail | Case remains unacknowledged |
| Backup accepts | Named follow-up owner is shown; case awaits outcome |
| User responds during escalation | Unsent calls cancelled; active contact updated |
| Provider callback repeats | One state transition; no duplicate booking or alert |
| Clinic call fails | Pending/failed shown; no confirmation invented |
| Speech is unclear | Clarification or alternative input; no silent consequential guess |

### A three-minute demo

Introduce the user's real problem. Show a voiced reminder and acknowledgement. Ask Nami for an appointment, approve the offered slot, and show a controlled clinic confirmation. Enable a clearly labelled accelerated demo clock, miss a check-in, and show the test caregiver accepting follow-up. End by completing the same interaction through buttons or a switch.

Keep the recorded fallback demonstration available for network failures, clearly labelled as recorded. Show actual execution logs for actions completed live.

<!-- pagebreak -->

## 10. Evidence and source notes

### WCC emphasis

Problem evidence: direct observations. Core solution: a completed reminder and human handoff. Technical quality: restart recovery and truthful failures. Originality: accessible desktop presence linked to completed care coordination. Usability: unassisted task completion. Trust: explicit permissions and evidence-linked states. [S12]

ElliQ already offers companionship, reminders, and caregiver features. Present Nami's selected interaction and workflow improvements accurately rather than claiming that the entire category is new. [S11]

### References

Sources checked on 4 October 2026. The workflow, UI, event model, acceptance criteria, and feature priorities above are proposed design decisions. They have not been clinically validated or implemented by this document.

- **S1 - Social connection:** National Institute on Aging, [Loneliness and Social Isolation: Tips for Staying Connected](https://www.nia.nih.gov/health/loneliness-and-social-isolation/loneliness-and-social-isolation-tips-staying-connected).
- **S2 - Medication management:** National Institute on Aging, [Taking Medicines Safely as You Age](https://www.nia.nih.gov/health/medicines-and-medication-management/taking-medicines-safely-you-age).
- **S3 - Physical accessibility:** W3C WAI, [Physical abilities and barriers](https://www.w3.org/WAI/people-use-web/abilities-barriers/physical/).
- **S4 - Speech accessibility:** W3C WAI, [Speech abilities and barriers](https://www.w3.org/WAI/people-use-web/abilities-barriers/speech/).
- **S5 - Emergency route:** Government of India, [Emergency Response Support System](https://112.gov.in/).
- **S6 - Device state:** Electron, [powerMonitor](https://www.electronjs.org/docs/latest/api/power-monitor).
- **S7 - Desktop limitations:** Electron, [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window/).
- **S8 - Calling capability:** ElevenLabs, [Outbound call via Twilio](https://elevenlabs.io/docs/eleven-agents/api-reference/twilio/outbound-call).
- **S9 - Call outcomes:** ElevenLabs, [Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks).
- **S10 - Local activation:** Picovoice, [Porcupine wake-word documentation](https://picovoice.ai/docs/porcupine/).
- **S11 - Existing product:** ElliQ, [Caregiver features](https://elliq.com/pages/caregivers).
- **S12 - Event rubric:** We Code Coders, [WCC Launchpad 30](https://wecodecoders.in/events/wcc-launchpad-30).

**Document pair:** use the separate mascot production guide for visuals and motion. Keep this workflow as the source of truth for permissions, calling outcomes, reminders, and escalation.
