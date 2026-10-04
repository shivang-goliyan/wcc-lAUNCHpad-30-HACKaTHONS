# Decision log

Add a dated row whenever something changes. If code disagrees with the docs, either fix the code or log a decision here.

| ID | Date | Decision | Why | Deviation from Codex source docs? |
|---|---|---|---|---|
| D1 | 4 Oct | **Website (Next.js on Vercel), not Electron.** The app page acts as the "desktop companion"; an Electron wrapper is P2. | Judges need a live link they can open with no install, and the user asked for a website. | Yes. Electron, the transparent floating window, wake word and `powerMonitor` are replaced by page heartbeat and visibility. "Device availability" now means "the Nami page was last seen at …". |
| D2 | 4 Oct | **The domain is elderly support: Nami Care**, as Codex specified. | The user chose it. | — |
| D3 | 4 Oct | **Voice: run a bake-off at 17:30 IST** between OpenAI `gpt-realtime-2.1` (WebRTC, `@openai/agents/realtime`) and Gemini `gemini-3.8-live` (`@google/genai`, ephemeral tokens). Criteria: Hindi and Hinglish naturalness, latency, reliable tool calls. **If they tie, choose Gemini** (about $0.02/min against roughly $0.10–0.30/min). Both sit behind `VoiceAdapter`. | Neither provider officially documents Hindi quality for OpenAI's model, and the cost matters because judges use the live link for days. | — |
| D4 | 4 Oct | **Text agents use Claude:** `claude-sonnet-5-5` for the caller, clinic sim and extractor, and `claude-haiku-4-5-20251001` for summaries and bulk eval. It can be swapped via env if the team's credits are elsewhere. | Reliable tool-forced structured output and good Hindi. | — |
| D5 | 4 Oct | **Phone: Bolna** (shared +91 caller ID, no KYC, $5 trial, verified numbers only, 2 concurrent calls). It is used for the video and the allow-listed numbers. **Judges use the AI clinic simulator plus the QR caregiver flow.** | Bolna is the only verified route to a +91 caller ID in hours. ElevenLabs over Twilio is blocked for India without Enterprise residency; Vapi and Retell only offer US numbers; Exotel and Plivo need KYC. | Codex cited ElevenLabs + Twilio, so that is replaced. |
| D6 | 4 Oct | **Scheduling** uses a QStash every-minute schedule, client heartbeat ticks, and the demo-clock skip. All engine logic uses a virtual clock. | Vercel Hobby cron is too coarse, and the demo needs time travel. | Codex's "accelerated demo clock" is kept and implemented as a virtual clock. |
| D7 | 4 Oct | **Caregiver channels:** the scoped link or QR (primary), a Bolna phone call (for allow-listed numbers), and Resend email **only after the domain is verified** (use the sponsor `.xyz` domain). No SMS or WhatsApp, because India requires DLT registration and WhatsApp needs business approval. | Feasible in hours. | — |
| D8 | 4 Oct | **Live updates use polling** (SWR at 1.5–2 s), not websockets. | Robust on serverless; fast enough. | — |
| D9 | 4 Oct | **Persistence is Supabase Postgres with Drizzle**, with a household-level `FOR UPDATE` lock and a transactional outbox. | Correctness under duplicate callbacks and retries, which the judges score as reliability. | — |
| D10 | 4 Oct | **Mascot:** use the layered PNG `PoseRig` first and swap in Rive if a `.riv` arrives (same `NamiProps` contract). She roams on the landing page and stays calm and docked in the app. | Matches the source doc's "fast route", and the user wants movement on the website. | Adds roaming on the landing page only; the app keeps "no movement across the user's work". |
| D11 | 4 Oct | **Memory Corner is P1**, after P0 is green. | It's the emotional "connection not replacement" proof, but it isn't core. | Codex: "add after core works". Same. |
| D12 | 4 Oct | **Judge sandbox:** one isolated seeded household per visitor (`/try`, 48 h expiry), a visible demo clock, and caps on voice and calls. | Usability is judged without a walkthrough, and judges must not collide with each other. | New. |

## Open questions for the team lead

Each one has a default we will use if there's no answer.

1. **Team:** how many people and who does what? The default is the 4-role split in `BUILD-PLAN.md`.
2. **Mascot assets:** layered PNG rig or Rive, and when? The default is PNG layers by 23:00.
3. **API credits:** which of OpenAI, Gemini and Anthropic do we have? The default needs Gemini or OpenAI for voice and Anthropic for text agents.
4. **Phones:** which two teammates' numbers play the "clinic" and "Arjun"? They must be added to Bolna Verified Numbers.
5. **Evidence:** who can we interview tonight (grandparents, parents, friends' parents)? This is worth 15 points.
6. **Domain:** will we claim the `.xyz` perk (e.g. `namicare.xyz`) for the live link and Resend?
7. **Name:** is "Nami Care" final? What's the team name, in CAPS as the form asks?
