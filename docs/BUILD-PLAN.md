# Nami Care — Build plan (Sun 4 Oct 16:30 → Mon 5 Oct 14:00 IST)

**Hard deadline: the form is submitted by 13:30 Mon. Every member submits their own form.** Features freeze at **10:00 Mon**.

**Roles** (rename to real people):

| Role | Owns |
|---|---|
| **L** (lead) | Backend and agents |
| **F** | Frontend app and the voice client |
| **D** | Design, mascot and landing visuals |
| **P** | Product: evidence, landing copy, video and submission |

With 3 people, P's work is split between D and L.

## 1. Timeline

| IST | L (backend/agents) | F (frontend/voice) | D (design/mascot) | P (product/evidence) |
|---|---|---|---|---|
| **16:30–17:30** | Accounts: Vercel, Supabase, QStash, Anthropic, OpenAI and/or Gemini, Bolna (+ verified numbers). Scaffold Next.js, deploy "hello" to the live URL. | Voice spike: the minimal Talk button with both providers | Approve the master Nami neutral (from the concept art) | Send interview requests; publish the survey (§6) |
| **17:30–18:00** | Hindi **bake-off** with F (D3). Lock the provider. | Bake-off | Start the rig layers | Interviews |
| **18:00–21:00** | `lib/db/schema.ts`, seed, the engine for reminders and appointments, verifiers, vitest for tests 1, 2, 9–12, 15 | `/app` layout, buttons and keyboard, My Day, `/api/state` polling, `NamiStage` with placeholder art, captions | Rig layers (A) | Interviews; landing copy EN/HI; data cards |
| **21:00–00:00** | `/api/voice/session` + tool routes; caller + clinic sim + extractor; outbox | Realtime client + tool bridge + interruption; ApprovalCard; live call transcript; lip-sync | Poses (B): listening, thinking, reminder, calling, help, nod | Landing build with D: hero, sections, roaming path |
| **00:00–03:00** | Check-in and help engine, contact tokens, caregiver API, demo clock + skip, tests 3–8, 13, 14 | Help banner, caregiver page + QR, Activity panel, EN/हिं i18n, settings | Remaining poses (swim, peek, point, wave, quiet) + hero scene | Survey analysis; slide-worthy numbers; README draft |
| **03:00–05:00** | Sleep rotation: 2 people sleep at a time for 2 h. Before sleeping, deploy and run the end-to-end smoke test (`TRD.md` §14). | | | |
| **05:00–08:00** | Bolna adapter + webhooks + real calls to the verified phones; cost caps; `eval:intents`, `eval:calls` | Integrate final art; reduced motion; accessibility pass; text-mode fallback; `/console` | Polish the landing animation; app micro-interactions | Memory Corner (P1) with L, if P0 is green |
| **08:00–10:00** | Bug bash, eval results to README, architecture diagram | Bug bash on mobile and incognito | Thumbnail, video graphics | Script and shot list (`PRD.md` §9); rehearse |
| **10:00** | **FEATURE FREEZE.** Only bug fixes after this. | | | |
| **10:00–12:00** | Record the video with real phones ringing (clinic and Arjun) using the `video` household | Monitor the prod build | Edit the video (≤ 3 min) | Direct; voice-over |
| **12:00–13:30** | Final deploy check: `/try` works in a fresh incognito window on a phone, the repo is public, keys aren't committed | | | Form answers (§5), each member submits |
| **13:30–14:00** | Buffer. Don't change anything. | | | |

**Go/no-go gates:**

| Time | Gate | If it fails |
|---|---|---|
| **21:00** | A voice turn calls a tool and changes state on the live URL | Go text-first and keep voice for the landing demo |
| **00:00** | The appointment flow works end to end in sim mode | Cut Memory Corner and settings polish |
| **05:00** | All P0 items work on prod | No P1 work; polish P0 only |

## 2. P0 checklist (definition of done)

- [ ] Landing: Nami roams, Talk to Nami works live, `/try` works.
- [ ] Voice in Hindi, English and Hinglish, with captions and interruption; text fallback.
- [ ] Reminder occurrence with all outcomes; duplicate-safe.
- [ ] Appointment: propose → permit → sim call streamed → verifier checks shown → approve → confirm → reminder created.
- [ ] Check-in ladder with demo skip; caregiver QR accept; user-responds cancellation; unresolved state.
- [ ] Get Help immediate, with 112 shown and a "by mistake" option.
- [ ] Activity panel and `/console` timeline.
- [ ] Caps and rate limits; kill switches.
- [ ] `pnpm test` green; eval results committed.
- [ ] README: problem, demo link, video, architecture, agents, eval, setup, honest limitations.

## 3. Branching and deploys
- Merge `main` → Vercel production only after the smoke test passes. Feature branches merge through short PRs, or direct pushes if the team agrees.
- Never commit `.env*`. Run `git secrets` or a `grep` for keys before making the repo public.

## 4. Repo README outline
1. One-liner and GIF.
2. Live link, video and "Try as Meera".
3. The problem with data and our interviews.
4. What Nami does.
5. Architecture diagram (`TRD.md` §1).
6. Agents and the "LLMs propose, code disposes" principle.
7. Reliability: state machines, idempotency and outbox.
8. Eval results.
9. Responsible design.
10. Running locally.
11. Limitations, and what is simulated.
12. Team.

## 5. Form answers (draft; finalise at 12:00)

| Field | Draft |
|---|---|
| Project name | Nami Care |
| Problem (one line) | 1 in 4 Indian elders have no child at home, and when a pill, a doctor's appointment or a missed phone call goes wrong, nobody coordinates the follow-up. |
| Solution | A Hindi/English voice companion that reminds, books doctor appointments by phoning the clinic with the user's approval, and runs an agreed check-in ladder that hands off to family, who must accept responsibility. |
| Target users | Older adults living apart from family (and people with limited hand movement), plus their adult children. |
| Distinctive | It acts in the real world (it phones clinics and family) with approval gates. Its states are evidence-linked: no LLM can mark an appointment confirmed or a person safe. |
| Prompt architecture / agents / eval | `AGENTS.md` §9 plus the real eval numbers |

## 6. Survey (Google Form, 6 questions; send by 17:00)
For people with a parent or grandparent aged 60+ living away from them:
1. How far away does your parent live? (same city / different city / different country)
2. In the last 3 months, did they miss medicines or a doctor's follow-up that you found out about later? (often / sometimes / never)
3. Who books their doctor appointments today? (they do / I do remotely / a neighbour or helper / nobody, they skip)
4. When your parent doesn't pick up the phone, what do you do, and how long until you know they're OK? (free text)
5. Would you want an AI companion that calls you only when a check-in is missed and waits for you to accept? (1–5)
6. Would your parent talk to a friendly voice assistant in Hindi or their language? (yes / maybe / no, and why)

Report n and the percentages honestly in the README and the video.
