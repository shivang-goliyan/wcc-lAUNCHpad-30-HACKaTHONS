# Nami Care — Website and mascot design spec

**Version:** 1.0, 4 Oct 2026
This is the contract between the design team (art, motion) and the developers (`components/nami`). Character identity rules come from `source/Nami-Care-Mascot-Generation-and-Animation.md`. This file adds what the **website** needs.

## 1. Two moods, one character

| Surface | Mood | Nami's movement |
|---|---|---|
| **Landing `/`** | Delightful and showy, the "wow" first impression | **Roams.** She swims across wave dividers, peeks from section edges, points at feature cards, follows the cursor with her eyes and floats on her back holding a card |
| **App `/app`** (Meera) | Calm, readable, respectful | **Docked** at the bottom-right, beside the conversation panel. She moves only for real state changes. No movement crosses content. |
| **Caregiver `/care/[token]`** | Clear, mobile, factual | A small static avatar only |
| **Console `/console`** | Technical showcase | A small Nami beside the agent graph, whose pose follows the active agent |

## 2. Design tokens

```css
--teal-900:#173D38;  /* headers, primary text on light */
--sea-500:#80A99B;   /* accents, Nami scarf */
--ivory-50:#F7F3EA;  /* page background */
--cocoa-500:#8A6046; /* Nami fur, warm accents */
--help-600:#B8463B;  /* Get Help ONLY — never decorative */
--ink-900:#1E2422;  --ink-600:#4A5552;  --line:#DCD6C8;
--ok-600:#2F7A55 (confirmed/accepted)  --warn-600:#B7791F (pending)  --bad-600:#B8463B (failed/unresolved)
radius: 20px cards, 999px pills · shadow: 0 8px 30px rgba(23,61,56,.10)
```

- **Typography.** "Fraunces" (display, English) with "Tiro Devanagari Hindi" (display, Hindi). "Noto Sans" with "Noto Sans Devanagari" for UI. App base text is 20 px with a user scale of 1.0–1.4.
- **Contrast.** WCAG AA minimum. Status always pairs **colour, icon and text**.
- **Dark mode.** Not needed. Provide the ivory theme plus a high-contrast option in the app.

## 3. Pages (wireframes in words)

### 3.1 Landing `/`

1. **Hero** (100vh). This is a lake scene: a misty mountain illustration, with water whose shimmer is CSS/SVG-animated.
   - Nami sits on a rock.
   - Headline: "Your parent's gentle companion — who actually gets things done." In Hindi: "आपके माता-पिता की साथी — जो काम भी करवाती है।"
   - Buttons: **Talk to Nami** (live voice, right on the page) and **Try the full demo as Meera →** (`/try`).
   - An EN/हिं toggle.
   - Nami waves once and her eyes track the cursor.
2. **The problem.** Three big data cards appear as you scroll:
   - "1 in 4 Indian elders have no child at home" (LASI)
   - "8.3% depression measured vs 0.8% diagnosed" (LASI)
   - "only 41% own a smartphone" (HelpAge)
   - plus an interview quote (real).
   - Nami *swims* along the wave divider into this section.
3. **What Nami does: four jobs.** Cards for Reminds, Books appointments (calls the clinic), Checks in and Gets your people. Nami pops up next to each card as it enters, in the matching pose (reminder card / phone / waving / help paw).
4. **The appointment, live.** An auto-playing *recorded* (labelled) mini-replay of the agent console: transcript lines, verifier ticks, and "Confirm?" → confirmed.
5. **How Nami stays honest.** A visual ladder: "Check-in missed → retry → phone → Arjun → Priya". Nami holds a sign: "I never mark anyone safe. A person does."
6. **For families.** A phone mockup of the caregiver page, with a QR code to try it.
7. **Trust.** AI disclosure, approval gates, what's stored, 112 and Tele-MANAS.
8. **Team** and the footer. Nami falls asleep (quiet pose) at the bottom of the page.

### 3.2 App `/app` (desktop-first, works on a tablet)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Nami Care · Meera ji          Demo time Sun 09:58 ⏩ Skip   EN|हिं  ⚙  Aa+  │
├───────────────────────────────────────────────┬───────────────────────────┤
│  ┌───────────────── Conversation ──────────┐  │  Agent activity  (toggle) │
│  │ Captions (both sides, large)            │  │  • 09:58 Engine: check-in │
│  │ ApprovalCard (when pending):            │  │    due (rule: daily 10:00)│
│  │  "Thu 8 Oct, 10:30 AM · Dr. Mehta"      │  │  • Caller → Clinic (live  │
│  │  [ Yes, confirm ]  [ No ]               │  │    transcript)            │
│  │ Call transcript (when calling, live)    │  │  • Verifier ✓ in range ✓  │
│  └─────────────────────────────────────────┘  │    clinic approved ✓ ...  │
│  [🎙 Talk (Space)] [📅 My Day] [👪 Call family] │                           │
│  [ 🔴 Get Help (H) ]   [🔇 Mute (M)]     NAMI ►│  Caregiver QR (scan me)   │
└───────────────────────────────────────────────┴───────────────────────────┘
```

- The **Help banner** has the highest priority. When a case is open it pins to the top with truthful progress and "Emergency? Call 112".
- **Status chips** sit outside the canvas: mic (listening / muted / unavailable), connection (online / reconnecting / offline) and the case status.

### 3.3 Caregiver `/care/[token]` (mobile)
- A header shows "Meera Sharma · Jaipur" and the last explicit response time.
- If a case is open, a big card shows the facts and four buttons: **I'll check now**, **I can't**, **I spoke with her**, **Still needs help**.
- Below that are the appointment status, shared reminder outcomes and the Memory Corner upload (P1).

### 3.4 Console `/console`
- The agent graph (from `AGENTS.md` §1) with live highlighting.
- The full event timeline, filterable by actor.
- A call transcript viewer showing verifier checks.
- The eval results card.

## 4. Mascot build: SVG rig (built by Claude, `DECISIONS.md` D10)

Nami is a single React SVG component, `components/nami/NamiSvg.tsx`, drawn on a 400×400 viewBox with the feet baseline at y = 370. The style is a soft 2.5D vector look: radial gradients for the fur volume, a cream muzzle and belly, a soft rim light, and a sea-green scarf with a knot. The Codex concept (`design/reference/concept-000.png`) is the identity reference.

**Named groups**, each with its own `transform-origin` pivot:
- `tail` (base), `body`, `belly`, `legs`
- `arm-l`, `arm-r` (shoulder), `paw-l`, `paw-r`
- `head` (neck), `ear-l`, `ear-r`
- `eye-l`, `eye-r` (whites + iris + pupil + highlight), `lid-l`, `lid-r` (blink scaleY), `brow-l`, `brow-r`
- `muzzle`, `nose`, `whiskers`
- `mouth`, which switches between 5 shapes: `closed-smile`, `small`, `wide`, `round`, `soft-o`
- `scarf-knot`, `scarf-tail`
- `prop` slot: `phone`, `clock-card`, `notebook`, `heart`, `sign`

**Poses are data**, not separate art. Each pose is a table of part transforms (`lib/nami/poses.ts`). The poses are:
`idle`, `greeting` (wave), `listening` (head tilt, paw to ear), `thinking` (notebook, eyes up), `speaking` (open-handed gesture), `reminder` (clock card at chest), `acknowledged` (nod), `calling` (phone to ear), `help` (upright, paw extended), `quiet` (eyes closed, curled), `swim` (on her back, holding a card), `peek` (cropped by the container edge), `point-left`, `point-right`.

**Release checks:** readable at 120 px; looks right on ivory and teal; no part gaps during any transition; reduced-motion static frames look intentional; rendered and visually checked through Playwright screenshots for every pose (`design/renders/`).

## 5. Rendering implementation

- `NamiStage` takes a `NamiProps` contract (§6) and renders `NamiSvg` with the pose for the state.
- **`NamiSvg`** animates its part groups with `motion` (springs between pose tables):
  - **Breathing:** body `scaleY` 1 → 1.015 over 5 s, eased.
  - **Blinking:** irregular, every 3–7 s, lids visible for 120 ms.
  - **Tail:** sway ±4° over 6 s.
  - **Scarf:** sway ±3°.
  - **Head:** tilt (listening = 6°).
  - **Pupils:** follow the pointer (landing) or the focused UI element (app).
  - **Mouth:** swap images by the `mouthOpen` thresholds (§7).
  - **Pose changes:** spring-interpolate every part transform over about 250 ms, so there is no crossfade and no jump.
- **`RoamingNami`** (landing only) is a fixed-position layer.
  - `useScroll` → progress → keyframes along an SVG path per section, with a pose per segment (swim on wave dividers, peek at section edges, point at cards).
  - On mobile she only peeks and points.
  - Above 30% scroll velocity she switches to the swim pose.
- **Reduced motion** (OS setting or app toggle) turns off roaming, breathing and tracking. She shows static poses only, and the status text still works.
- **Performance budget:** at most 60 fps on a mid laptop; under 2 MB of mascot assets on first load (lazy-load the poses); idle CPU under 5%. Pause animation when `document.hidden`.

## 6. App → animation contract

The property names come from the source doc. They are binding.

```ts
type NamiProps = {
  interactionState: 'idle'|'greeting'|'listening'|'thinking'|'speaking'|'reminder'|'acknowledged'|'calling'|'help'|'quiet';
  mouthOpen: number;          // 0..1, from OUTPUT audio only
  microphoneState: 'active'|'muted'|'unavailable'|'off';
  connectionState: 'online'|'reconnecting'|'offline';
  reducedMotion: boolean;
  caseStatus: null | 'escalating'|'owner_accepted'|'unresolved'|...;
  activeTurnId: string | null; // stale events for other turn ids are ignored
  lookAt?: { x: number; y: number } | null;
  size: 'sm'|'md'|'lg';
};
```

**Priority:** `help` (any open help case) > `calling` > `speaking` > `listening` > `thinking` > `reminder` > `acknowledged` (one-shot, 900 ms) > `quiet` > `idle`.

- An open help case is never visually replaced. The `calling` status shows as a chip instead.
- The connection badge is shown independently.

## 7. Lip-sync (`components/nami/lipsync.ts`)

1. Feed the output audio into an `AnalyserNode` (fftSize 1024).
2. On every animation frame, take the RMS of the time-domain data.
3. Shape the envelope: attack 30 ms, release 90 ms.
4. Map to `mouthOpen = clamp((rms − 0.02) / 0.18, 0, 1)`.
5. Choose the mouth: below 0.08 closed; 0.08–0.35 small; 0.35–0.7 wide; above 0.7 round (alternate wide and round every 140 ms so it doesn't look static).
6. When playback ends, fails, pauses, or the user interrupts, set it to 0 immediately.
7. In text mode, drive it from `speechSynthesis` boundary events with a synthetic envelope.

This is described honestly as speech-reactive movement, not phoneme-accurate lip-sync.

## 8. Voice and sound
- Nami's voice is warm, adult, female and unhurried. The speaking speed is user-adjustable (0.85–1.15).
- No sound effects other than a soft chime for reminders. Help actions have no alarm sounds.
