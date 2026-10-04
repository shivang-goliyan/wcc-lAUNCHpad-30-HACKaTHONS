# Submission kit (Mon 5 Oct) — video script and form answers

Everything here uses only verified numbers (`research/evidence-2026.md`) and machine-written eval results
(`public/eval-results.json`). Anything simulated is said to be simulated.

## 1. The 3-minute demo video

Record at 1440×900 in Chrome, sound on. Open a **fresh** demo first (`/try` in an incognito window) so the
household starts at 08:55. Have a phone ready to scan the caregiver QR (it plays Arjun).

| Time | On screen | Voice-over (calm, one speaker) |
|---|---|---|
| 0:00–0:15 | raynet.in hero: the scrapbook, Nami waves. Slow scroll to the first day moment. | "In India, one in four people over 60 have no child at home. Their children love them, from Bengaluru, Pune, Dubai." |
| 0:15–0:35 | Keep scrolling: Nami walks from sunrise to the breakfast table; her bubble says "BP tablet after breakfast". Tap Nami once. | "This is Nami, an AI companion. She always says she's an AI. She reminds, she chats in Hindi or English, and she gets things done." |
| 0:35–0:55 | `/try` → Meera's screen. Press **Talk to Nami**: "Nami, aaj mera din kaisa hai?" Nami answers aloud, lip-synced. | "Meera ji just talks. Nami listens, answers in her language, and reads her day back." |
| 0:55–1:45 | Say: "Agle hafte Dr. Mehta ke yahan subah ka appointment book kar do." Nami reads it back, asks permission → "Haan, kar do." Switch to `/console`: the Caller agent phones the **simulated clinic**, the transcript streams, the Verifier ticks 8 checks. Back on Meera's screen: approve the slot. Clinic: "confirm ho gaya". Reminders appear. | "With her permission, Nami's caller agent phones the clinic. This clinic is simulated for the demo. Every claim the AI makes is checked by plain code: the date, the time window, that the slot is really in the calendar, that nothing private was said. Meera says yes twice. It's booked only when the clinic confirms." |
| 1:45–2:30 | Press **Skip to next event** until the 10:00 check-in goes unanswered. The evidence panel shows, the ladder starts. Scan the QR with the phone → caregiver page → **I'll check**. Meera's screen updates. Arjun reports "I spoke with her". | "If she doesn't answer, Nami follows the plan Meera agreed to. A notification isn't enough: her son has to accept. Nobody is ever marked safe by a machine; a person is." |
| 2:30–2:50 | `/console` eval card and the audit timeline. Quick cut: say "Ab jeene ka mann nahi karta" → a help case opens with 112 and Tele-MANAS 14416. | "We tested it: thirty simulated clinic calls, zero false confirmations, zero private data shared. And two crisis checks that don't depend on the AI at all." |
| 2:50–3:00 | Back to the landing page footer, Nami asleep under the lamp. raynet.in on screen. | "Nami keeps them company. Raynet makes sure someone shows up. Try it at raynet.in." |

**Do / don't:** say "simulated clinic" at least once on camera; don't show any `.env` or key; keep the
demo-time chip visible when skipping time; if voice is slow on the day, type the same lines instead.

## 2. Form answers (draft — fill in the team details)

| Field | Answer |
|---|---|
| Team name | **(CAPITALS — from the lead)** |
| Members and roles | **(from the lead)** |
| Project name | Raynet (with Nami, the companion) |
| Live link | https://raynet.in (demo: https://raynet.in/try) |
| Repository | https://github.com/shivang-goliyan/wcc-lAUNCHpad-30-HACKaTHONS (make public before submitting) |
| Problem (one line) | One in four Indian elders has no child at home, and when a pill, a doctor's follow-up or a missed phone call goes wrong, nobody coordinates the follow-through. |
| Solution | A Hindi/English voice companion, Nami, that reminds, books doctor appointments by phoning the clinic with the parent's approval, and runs an agreed check-in ladder that hands off to family, who must explicitly accept responsibility. |
| Target users | Older adults living apart from their children (and people with limited hand movement), and their adult children in other cities. |
| What makes it distinctive | It acts in the real world: it phones the clinic and the family. Its states are evidence-linked: no AI can mark an appointment confirmed or a person safe; plain code verifies every claim, and a human must accept every escalation. |
| How the agents work | Nami (conversation, 13 tools), a Caller agent, a Clinic simulator, an Extractor and a Family alert agent propose actions; a deterministic workflow engine is the only thing that changes care state, after verifiers check slot validity, consent in the user's own words, and data disclosure. Two crisis layers (a phrase net and the TypeSafe Jev classifier) open help regardless of the chat model. |
| Evaluation | Engine 28/28; 30 simulated clinic calls: 0 false confirmations, 0 disclosure violations, the right slot in 18/18 calls that had one; intent routing 54/60 on Gemini Flash-Lite (English 17/20, Hindi 19/20, Hinglish 18/20), safety cases 10/12 with both misses caught by the phrase net. |
| Problem evidence | LASI Wave 1, UNFPA India Ageing Report 2023, HelpAge India 2025, Cureus 2026, BMJ Open Quality 2025 (all quoted with sources in research/evidence-2026.md). We have not run our own interviews; we say so. |
| What's simulated | The clinic in the public demo (an AI receptionist on a fixed calendar), the demo clock, and the phone fallback in judge sandboxes. Real calls go only to allow-listed numbers. |
