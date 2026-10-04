@AGENTS.md

# CLAUDE.md — Nami Care (WCC Launchpad 30, Agentic AI track)

**Deadline:** submit by Mon 5 Oct 2026, 13:30 IST (it closes at 14:00). Feature freeze is 10:00.

**Before building anything, read `docs/README.md`.** The docs are the spec. Don't invent features, states, names or numbers that aren't in them. If you need to change the plan, add a row to `docs/DECISIONS.md` first.

## Non-negotiables
- **LLMs propose, code disposes.** Only `lib/engine` changes care state. Tools, the caller, the extractor and webhooks send commands; they never write state directly.
- **Consequential actions are two-phase:** propose, then confirm. Confirmation must come from a UI button or pass `lib/verify/affirmation.ts` against the real user transcript.
- **No state or UI text says "safe", "fine", "booked" or "confirmed"** without the evidence required in `docs/TRD.md` §5. Failures are shown truthfully.
- No medical advice, no dosing, and no diagnosis. Nami discloses that she is an AI. 112 is always visible in help flows.
- Provider secrets stay server-side. Validate every input with zod. Every query is scoped by `household_id`.
- Real phone calls go **only** to `PHONE_ALLOWLIST`. Judges use the sim clinic.
- Engine functions are pure and take `now`. Never call `Date.now()` inside `lib/engine`.
- Every engine or verifier change comes with a vitest test (`docs/TRD.md` §13).
- Never hand-edit eval numbers. Never claim simulated things are real; label "Simulated clinic", "Demo time" and "Recorded".
- Accessibility: every voice action has a button or keyboard equivalent, and status text sits outside the mascot canvas.

## Commands (fill in once scaffolded)
- `pnpm dev` · `pnpm test` · `pnpm eval:intents` · `pnpm eval:calls` · `pnpm db:push`

## Git
- Commit with clear messages; never commit `.env*`.
