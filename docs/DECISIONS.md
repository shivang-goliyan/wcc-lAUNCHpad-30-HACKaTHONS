# Decision log

Add a dated row whenever something changes. If code disagrees with the docs, either fix the code or log a decision here.

| ID | Date | Decision | Why | Deviation from Codex source docs? |
|---|---|---|---|---|
| D1 | 4 Oct | **Website, not Electron. Hosted on the team's VM** with Docker Compose (Caddy for HTTPS, Next.js `web`, a Node `worker`, Postgres). *(Updated 17:10: the VM replaces Vercel, at the lead's request.)* | Judges need a live link they can open with no install; the lead runs a VM. | Yes. Electron, the floating window, wake word and `powerMonitor` are replaced by page heartbeat and visibility. "Device availability" now means "the Nami page was last seen at …". |
| D2 | 4 Oct | **The domain is elderly support: Nami Care**, as Codex specified. | The user chose it. | — |
| D3 | 4 Oct | **Voice: run a bake-off at 17:30 IST** between OpenAI `gpt-realtime-2.1` (WebRTC, `@openai/agents/realtime`) and Gemini `gemini-3.8-live` (`@google/genai`, ephemeral tokens). Criteria: Hindi and Hinglish naturalness, latency, reliable tool calls. **If they tie, choose Gemini** (about $0.02/min against roughly $0.10–0.30/min). Both sit behind `VoiceAdapter`. | Neither provider officially documents Hindi quality for OpenAI's model, and the cost matters because judges use the live link for days. | — |
| D4 | 4 Oct | **Text agents use Claude:** `claude-sonnet-5-5` for the caller, clinic sim and extractor, and `claude-haiku-4-5-20251001` for summaries and bulk eval. It can be swapped via env if the team's credits are elsewhere. | Reliable tool-forced structured output and good Hindi. | — |
| D5 | 4 Oct | **Phone: Twilio, calling from a US number** to Twilio-verified team phones. The Caller agent (Claude) runs turn by turn over `<Say>`/`<Gather input=speech language=hi-IN>`; ConversationRelay is the v2 upgrade. **Judges use the AI clinic simulator plus the QR caregiver flow.** *(Updated 17:10: replaces Bolna, at the lead's request.)* | The goal is to prove that real calls work. An international caller ID and the trial notice are acceptable. | Codex cited ElevenLabs + Twilio; we keep Twilio but drive it with our own agent. |
| D6 | 4 Oct | **Scheduling:** the `worker` process ticks every 5 s and dispatches the outbox. Client heartbeats and the demo-clock skip also tick. All engine logic uses a virtual clock. | Long-running processes are available on the VM; the demo needs time travel. | Codex's "accelerated demo clock" is kept and implemented as a virtual clock. |
| D7 | 4 Oct | **Caregiver channels:** the scoped link or QR (primary, always), a Twilio phone call (allow-listed numbers), and email only if a domain and Resend are set up (optional). No SMS or WhatsApp. | Feasible in hours. | — |
| D8 | 4 Oct | **Live updates use polling** (SWR at 1.5–2 s). | Simple and robust; fast enough. | — |
| D9 | 4 Oct | **Persistence is Postgres 16 (Docker) with Drizzle**, with a household-level `FOR UPDATE` lock and a transactional outbox. | Correctness under duplicate callbacks and retries, which the judges score as reliability. | — |
| D10 | 4 Oct | **Mascot is built in code by Claude as a layered SVG rig** (`components/nami/NamiSvg.tsx`), redrawn from the Codex concept art. It keeps the cocoa fur, cream muzzle, sea-green scarf and rounded ears. Every part is its own group (body, head, ears, eyes, lids, pupils, brows, 5 mouth shapes, arms, paws, tail, scarf end, props: phone, clock card, notebook), so all poses, blinking, lip-sync, waving and swimming are programmatic and always consistent. She roams on the landing page and stays calm in the app. *(Updated 17:10: there are no designers, and Higgsfield has 0 credits.)* | No designer and no image-generation credits. A vector rig gives perfect consistency and true lip-sync. The Codex raster art stays as the reference and README concept art. | Replaces the PNG/Rive routes; the `NamiProps` contract is unchanged. |
| D11 | 4 Oct | **Memory Corner is P1**, after P0 is green. | It's the emotional "connection not replacement" proof, but it isn't core. | Codex: "add after core works". Same. |
| D12 | 4 Oct | **Judge sandbox:** one isolated seeded household per visitor (`/try`, 48 h expiry), a visible demo clock, and caps on voice and calls. | Usability is judged without a walkthrough, and judges must not collide with each other. | New. |

## Open questions for the team lead

Each one has a default we will use if there's no answer.

1. **Team:** how many people and who does what? The default is the 4-role split in `BUILD-PLAN.md`.
2. ~~Mascot assets~~: resolved by D10 (Claude builds the SVG rig).
3. **API credits:** which of OpenAI, Gemini and Anthropic do we have? The default needs Gemini or OpenAI for voice and Anthropic for text agents.
4. **Phones:** which two teammates' numbers play the "clinic" and "Arjun"? They must be added as Twilio Verified Caller IDs.
5. **Evidence:** who can we interview tonight (grandparents, parents, friends' parents)? This is worth 15 points.
6. **Domain:** will we claim the `.xyz` perk (e.g. `namicare.xyz`) for the VM? Otherwise use `<vm-ip>.sslip.io`.
8. **VM:** what OS, CPU and RAM, and do we have SSH access? Are ports 80 and 443 open?
7. **Name:** is "Nami Care" final? What's the team name, in CAPS as the form asks?
