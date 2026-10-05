# Submission kit (Mon 5 Oct) — video script and form answers

Everything here uses only verified numbers (`research/evidence-2026.md`) and machine-written eval results
(`public/eval-results.json`). Anything simulated is said to be simulated.

## 1. The demo film (2:32)

A launch film cut from screen recordings of the live site (raynet.in, recorded on 5 Oct), with narration
in one voice and every statistic sourced on screen. The clinic is labelled "Simulated clinic" whenever it
appears, and the narration says so.

| Time | Beat | What is on screen |
|---|---|---|
| 0:00 | Cold open | "Jaipur · 10:00 a.m." A call to Ma rings out. Her son is in Bengaluru, in a meeting. |
| 0:10 | The need | 1 in 4 elders with no child at home (LASI) · 347 million over 60 by 2050 (UNFPA) · 4 in 10 take long-term medicines poorly, top reason forgetting (Cureus 2026) · 1 in 2 BP patients never return for follow-up (J Hum Hypertens 2023) · 3 in 4 come back once a person follows up (BMJ Open Quality 2025) |
| 0:36 | Meet Nami | Nami waves, says "नमस्ते मीरा जी" in her real voice; the landing page and the day with Nami walking through it |
| 0:49 | She gets things done | Meera's screen: the booking request, the permission card, Nami on the phone with the simulated clinic |
| 1:08 | The rule | "Nothing gets booked on an AI's say-so." The 8 plain-code checks, Meera's two yeses, confirmed only on the clinic's words |
| 1:24 | Ten a.m. again | The missed check-in, the plan Meera agreed to, Arjun's phone: he has to accept. "Nobody is ever marked safe by a machine. A person is." |
| 1:48 | Crisis | Crisis words open help with 112 and Tele-MANAS 14416, whatever the model says |
| 1:56 | Nami calls you | 7 in 10 urban elders use a basic phone (HelpAge 2025), so Nami just rings: the "Let Nami call you" form |
| 2:08 | Proof | 30 simulated clinic calls, 0 false confirmations, 0 private details shared; the agent console: "The AI proposes. Code decides." |
| 2:20 | Close | "Nami keeps them company. Raynet makes sure someone shows up." raynet.in |

The phone-call request in the film was staged so no call was placed while recording; the feature itself is
live and capped (see D25).

## 2. Form answers

| Field | Answer |
|---|---|
| Team name | GOLIYANSHIVANG07 |
| Members and roles | Shivang Goliyan: product, engineering, agents and voice · Vansh Khewal: design and front end |
| Project name | Raynet (with Nami, the companion) |
| Live link | https://raynet.in (demo: https://raynet.in/try) |
| Repository | https://github.com/shivang-goliyan/wcc-lAUNCHpad-30-HACKaTHONS (make public before submitting) |
| Problem (one line) | One in four Indian elders has no child at home, and when a pill, a doctor's follow-up or a missed phone call goes wrong, nobody coordinates the follow-through. |
| Solution | A Hindi/English voice companion, Nami (say "Hey Nami", or she phones a basic phone), that reminds, books doctor appointments by phoning the clinic with the parent's approval, and runs an agreed check-in ladder that hands off to family, who must explicitly accept responsibility. |
| Target users | Older adults living apart from their children (and people with limited hand movement), and their adult children in other cities. |
| What makes it distinctive | It acts in the real world: it phones the clinic and the family, and it can phone the elder (a judge can enter their own number and talk to Nami as the parent). Its states are evidence-linked: no AI can mark an appointment confirmed or a person safe; plain code verifies every claim, and a human must accept every escalation. |
| How the agents work | Nami (conversation, 13 tools), a Caller agent, a Clinic simulator, an Extractor and a Family alert agent propose actions; a deterministic workflow engine is the only thing that changes care state, after verifiers check slot validity, consent in the user's own words, and data disclosure. Two crisis layers (a phrase net and the TypeSafe Jev classifier) open help regardless of the chat model. |
| Evaluation | Engine 28/28; 30 simulated clinic calls: 0 false confirmations, 0 disclosure violations, the right slot in 18/18 calls that had one; intent routing 54/60 on Gemini 3.5 Flash-Lite (English 17/20, Hindi 19/20, Hinglish 18/20), safety cases 10/12 with both misses caught by the phrase net. If the model is slow or out of quota, requests are hedged to Gemini 3.1 Flash-Lite and then Gemma 4. |
| Problem evidence | LASI Wave 1, UNFPA India Ageing Report 2023, HelpAge India 2025, Cureus 2026, BMJ Open Quality 2025 (all quoted with sources in research/evidence-2026.md). We have not run our own interviews; we say so. |
| What's simulated | The clinic in the public demo (an AI receptionist on a fixed calendar) and the demo clock. The "Nami calls your phone" call is real: Indian and US mobiles only, 2 calls per number per day, 20 per day site-wide, 3 minutes each. |
