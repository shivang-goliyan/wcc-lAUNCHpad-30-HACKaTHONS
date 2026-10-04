# Nami Care

## Mascot generation and animation guide

**Version 1.0 | 4 October 2026 | Art direction and implementation specification**

Nami is a small, soft otter with cocoa-brown fur, a cream muzzle and belly, rounded ears, expressive dark eyes, a curved tail, and a simple sea-green scarf. Its presence should feel familiar, calm, and respectful to adult users.

**Visual direction:** a softly rendered 2.5D character with the warmth of the generated reference artwork. Use a stable seated pose for the desktop and clear expressions that remain readable at small sizes.

**Important production distinction:** the generated pose sheet and desktop mockup are static visual references. They are not a rig, a sprite atlas, a working application, or a .riv file. Animation requires prepared assets and runtime logic.

**Recommended route:** use a small set of consistent transparent pose assets with simple motion for the hackathon if no animator is available. Use a layered Rive character for finer, continuous motion when the team has time to prepare the rig.

The PDF edition embeds the generated character board and desktop mockup. This Markdown edition contains the complete written production specification and reusable prompts.

**Related document:** Nami-Care-Product-Workflow.md defines the actual care, contact, reminder, and appointment behaviour. Visual effects must always follow those states.

<!-- pagebreak -->

## 1. Character and interface art direction

### Preserve these identity features

- One rounded otter face, two small ears, two arms, two legs, and one tail.
- Cocoa-brown outer fur with a cream muzzle and belly; dark readable eyes and subtle eyebrows.
- One sea-green scarf with a consistent knot and direction.
- Soft materials, restrained highlights, diffuse lighting, and a friendly adult presentation.
- A recognisable silhouette even at approximately 180 to 260 CSS pixels tall; provide a user-controlled size setting.

Suggested design tokens: deep teal #173D38; sea green #80A99B; warm ivory #F7F3EA; cocoa #8A6046; help accent #B8463B. These are proposed implementation colours, not measurements sampled from the images. Check text contrast in the actual UI.

### Personality through motion

Use gentle breathing, occasional blinking, small head tilts, and modest paw gestures. Let posture communicate attention. Avoid frantic movement, exaggerated distress, or a disappointed expression when the user leaves.

Keep the mascot near a user-chosen screen edge. Open a readable conversation panel beside it. Talk, My Day, Get Help and Mute must be normal accessible controls outside the animation canvas.

### Voice direction

Use a warm adult voice with clear pronunciation and adjustable speed. Ask for the preferred language and form of address. Leave space for slow responses. Nami is introduced as an AI; do not imitate a relative's identity or clone a voice without permission.

### What the reference images establish

The pose board establishes character identity and broad expressions. The desktop mockup establishes a floating companion plus a readable panel. Its pictured calendar, operating-system furniture, and oversized demonstration panel are illustrative. They do not define the production OS, date, or final dimensions.

<!-- pagebreak -->

## 2. Generate consistent assets

Choose one approved master character image first. Attach that same image to every later generation or edit request. State which part may change and which identity features must remain fixed.

### Production sequence

1. Generate or extract a clean neutral character with a truly transparent background. Keep the full body, tail, and scarf inside the frame.
2. Approve the face, proportions, colour palette, and lighting. This becomes the master reference.
3. Generate one state per image using the master reference. Keep camera angle, character size, baseline, and padding consistent.
4. Inspect each asset for extra limbs, altered facial features, scarf changes, clipped edges, and unintended text.
5. Prepare either independent state images or editable layers. A collage of poses is useful for review but is not a production atlas.
6. Preview every asset on both light and dark backgrounds and at the real desktop display size.

### Master character prompt

> Create a single full-body Nami Care mascot: an original gentle otter with cocoa-brown fur, a cream muzzle and belly, small rounded ears, expressive dark eyes, subtle eyebrows, rounded paws, a curved tail, and one sea-green scarf. Use the attached approved Nami reference to preserve the exact face, proportions, colours and scarf. Soft matte 2.5D animation style, diffuse warm studio lighting, clear silhouette, calm adult-friendly expression. Seated neutral pose, three-quarter front view. True transparent background, square canvas, full body inside the frame with generous padding. No text, props, floor, cast background shadow, medical uniform, extra limbs, or extra characters.

### State variation prompt

> Use the attached approved Nami master as the identity reference. Change only the expression, paw pose and the specified prop for the [STATE] animation key pose. Preserve the face, fur colours, scarf, lighting, body proportions, camera angle and seated baseline. [INSERT STATE DIRECTION.] Generate one isolated character on a true transparent background with the same square framing and padding. No labels, no collage, no extra characters and no cropped tail or scarf.

**Generation settings:** request actual transparency rather than a painted checkerboard. Keep the same reference and framing for every request. Generate sensitive face details carefully and review visually; a prompt alone does not guarantee consistency.

<!-- pagebreak -->

## 3. Asset and layer preparation

### Fast pose-based route

Prepare neutral, listening, speaking, reminder, calling, help, and quiet images. Use a separate successful-action badge or small nod effect. Align each asset to the same invisible canvas so state transitions do not make the character jump.

Apply subtle transforms and opacity transitions in the application. Keep a neutral static image ready if an animation fails. This route can demonstrate responsiveness without pretending that the flat artwork is fully articulated.

### Layered Rive route

Prepare editable source art with hidden areas filled in behind moving limbs and accessories. Separating visible pixels from a flattened image will leave holes unless those hidden regions are reconstructed. A designer can redraw simplified vector forms or prepare aligned raster layers.

| Layer group | Separate elements |
| --- | --- |
| Body | Torso, cream belly and stable lower-body silhouette |
| Head | Head base, muzzle, nose, eyebrows |
| Eyes | Eye whites if used, pupils, eyelids and blink shapes |
| Mouth | Closed, small-open, wide-open and rounded-mouth shapes |
| Limbs | Left/right upper arms and paws with sensible pivots |
| Accessories | Scarf knot, loose scarf end and tail |
| Props | Phone, notebook and reminder card |
| Grounding | Optional independent soft shadow; never baked into the transparent background |

Rive supports raster images, layered PSD import, bones and mesh deformation. These provide a way to animate prepared art; importing a finished PNG does not automatically create a rig. [A1, A2]

### Proposed production asset names

- nami-master.png: approved neutral reference and fallback image.
- nami-listening.png, nami-speaking.png, nami-reminder.png, nami-calling.png, nami-help.png, nami-quiet.png: aligned transparent state images.
- nami-source.psd or nami-source.svg: editable source for the rigged route.
- nami-care.riv: authored interactive animation, only after the rig is built.
- nami-animation-manifest.json: state names, asset locations, loop behaviour and reduced-motion alternatives.

Keep reference boards separate from runtime assets. Verify licensing and attribution for any third-party animations, fonts, props or sound effects.

<!-- pagebreak -->

## 4. Animation states and timing

The values below are starting points for animation design, not medical or accessibility standards. Adjust them after testing with intended users.

| State | Motion and expression | Starting timing |
| --- | --- | --- |
| Idle | Gentle torso breathing, relaxed paws, occasional blink | Breathing loop 4-6 seconds; irregular blinks |
| Greeting | One small wave and warm eye contact | One-shot, about 1 second |
| Listening | Slight head tilt, attentive eyes, closed mouth | Hold while input is active |
| Thinking | Small glance toward a notebook; restrained head movement | Short loop; status text explains processing |
| Speaking | Mouth motion driven by output audio; occasional paw gesture | Follows actual audio playback |
| Reminder | Presents a clock or labelled card | Short entrance, then stable hold |
| Acknowledged | Gentle nod | One-shot after the outcome is saved |
| Calling | Phone to ear with a separate call-status label | Hold while the call is genuinely in progress |
| Help active | Calm upright attention and an extended paw | Stable pose while the case remains active |
| Quiet | Relaxed resting pose | Minimal motion or static frame |

### Motion rules

- Use roughly 150-300 ms transitions between compatible poses. Do not delay a help action while a visual transition finishes.
- Keep the character's lower-body anchor stable. Head and body should not snap between different scales.
- Avoid high-frequency bouncing, flashing, sudden sounds, or movement across the user's work.
- Stop the greeting after one wave. Do not replay it on every render or reconnection.
- Reduce movement when the mascot is hidden or the user requests reduced motion. Backend reminders must continue independently.

### State priority and independent indicators

An active help case has the highest visual priority. A background call must not replace its help panel. Within an ordinary conversation, use real input/output events to select listening, thinking, or speaking.

Connectivity and microphone state are separate indicators. For example, a help pose can coexist with an offline badge; an offline condition must not hide the unresolved help case. Quiet mode and reduced motion change presentation without erasing a case.

The application owns the actual workflow. A cheerful animation, a completed timeline, or a ringing-phone animation never proves that a booking, dose, or human handoff succeeded.

<!-- pagebreak -->

## 5. Speech, lip movement, and interruption

### Hackathon lip movement

Drive simple mouth opening from the assistant's outgoing audio, not from the user's microphone. Use an audio analyser to obtain an amplitude envelope, smooth it, and map it to a small mouth-open value. Close the mouth when playback ends, fails, pauses, or is cancelled.

This gives speech-reactive movement. It is not phoneme-accurate lip synchronisation. A fully flattened pose can use a speaking-state change and gentle body motion until separate mouth assets are available.

### Higher-quality lip sync

If the chosen speech service supplies suitable phoneme or viseme timing, map that timing to authored mouth shapes and align it with the audio playback clock. Availability and language coverage depend on the provider. Do not promise this capability until the actual service has been checked.

### Event sequence

1. User activates Nami; the microphone state and captions clearly indicate listening.
2. User speech ends; Nami enters processing only while a response or tool result is pending.
3. Audio playback starts; Nami enters speaking and the mouth controller starts.
4. The user interrupts; stop audio, clear queued mouth events, cancel stale visual events and return to listening.
5. A cancelled turn must not later display a success state or execute an unapproved tool action.

### Avoid conflicting audio

Keep one foreground speaking channel. A reminder should not talk over a clinic call. Routine announcements can queue or appear as silent cards; a help request takes priority. Captions and state labels remain visible whenever speech is unavailable.

### Proposed application-to-animation contract

| Property | Purpose |
| --- | --- |
| interactionState | idle, listening, thinking, speaking, reminder, calling, help, quiet |
| mouthOpen | Normalised output-audio envelope from 0 to 1 |
| microphoneState | wake-word, active, muted, unavailable |
| connectionState | online, reconnecting, offline |
| reducedMotion | Disable decorative movement without disabling controls |
| caseStatus | Actual help-case status supplied by the workflow service |
| activeTurnId | Reject stale speech or animation events from a cancelled turn |

These are proposed Nami property names, not claims about a provider SDK. Bind them through a small adapter so the rendering library can change without changing care logic.

<!-- pagebreak -->

## 6. Build and connect the animation

### Rive implementation sequence

1. Create an artboard with one stable coordinate system and import the prepared layers.
2. Set the head, arm, eyelid, scarf and tail pivots. Add bones and meshes only where they improve the intended movement.
3. Author idle, listening, thinking, speaking, reminder, calling, help and quiet timelines. Add short greeting and acknowledgement actions.
4. Build transitions and expose a documented data contract. Use the current Rive data-binding approach supported by the selected runtime. [A3]
5. Export the real .riv asset and load it with the official React runtime. Confirm the chosen renderer and current API names against the documentation. [A4]
6. Connect the application adapter to real voice, reminder and calling events. Keep the Get Help button independent of the animation loading successfully.
7. Test interruption, disconnected services, repeated events, hidden windows and reduced-motion behaviour on the actual demo computer.

### Fast implementation when a rig is not ready

Use the approved neutral and state images in an ordinary React component. Switch state images after genuine events, with short fades and small scale or rotation changes. Keep these transformations subtle and preserve the same baseline.

For a voice turn, the sequence is listening image, processing image, and speaking image during actual audio. For calling, show the phone image only after a call is started. Always display a separate text label for ringing, connected, no answer, and completed outcome.

### Desktop integration

Electron can host a frameless transparent window. Keep a separate normal application window for settings and the expanded interface. Maintain a visible tray or dock entry, an easy close/minimise action, and an accessible mute control. Do not hide the application from the user. [A5]

On Ubuntu Wayland, always-on-top and programmatic positioning have limitations. Test a normal docked companion window first. Select any X11/Xwayland fallback deliberately and test it on the user's actual environment; do not assume identical behaviour on all desktops. [A6]

Process wake-word activation locally where supported and display when conversational audio capture starts. Suspend/resume and disconnect events should change availability indicators. The mascot cannot remain conversationally available when its computer is asleep or powered off. [A7, A8]

**Practical recommendation:** complete the care workflow with pose-based animation first if artwork preparation threatens the deadline. A rigged Rive asset can replace the renderer later through the same state contract.

<!-- pagebreak -->

## 7. Reusable pose directions and quality checks

Insert one of these directions into the state variation prompt. Generate one asset per request, always using the approved master reference.

| State | Pose direction |
| --- | --- |
| Listening | Slight head tilt, one paw near the ear, mouth closed, calm attentive eyes |
| Speaking | Small open mouth, friendly explanatory gesture with one paw, stable seated body |
| Thinking | Holds a small plain notebook, eyes glance thoughtfully upward, gentle expression |
| Reminder | Holds a simple clock card at chest level; keep room for the app to render accessible text |
| Calling | Holds a small plain phone to one ear, other paw relaxed, attentive expression |
| Help | Upright and composed, one paw extended supportively, reassuring neutral face |
| Quiet | Comfortable seated or curled resting pose, softly closed eyes, scarf and tail visible |

### Optional short-loop reference prompt

> Animate the approved Nami otter in a calm stationary idle loop. Fixed camera and lighting. Preserve its face, colours, scarf, proportions and seated baseline. Use subtle breathing, one natural blink and a small ear movement. The first and last frame should connect smoothly. No walking, speaking, text, extra limbs, scene changes, camera movement or background elements. This is a motion reference; production transparency and runtime suitability must be checked separately.

Generated video can help communicate a motion style. It may drift between frames and does not replace an interactive rig or an accessible application.

### Release checks

- Identity is consistent in every state; no extra limbs, clipped tail, fake transparency or accidental text.
- The silhouette and expression remain readable at the smallest supported size.
- Every status has an accessible text equivalent outside the canvas.
- Keyboard, captions, switch support where implemented, and reduced motion work independently of speech.
- The microphone indicator reflects capture state, including failures.
- Speech interruption closes the mouth and clears stale turn events.
- Help and call outcomes match backend records, including no answer and unresolved cases.
- Minimise, mute, quiet mode and close remain easy to find.
- Monitor CPU, memory and animation smoothness on the target device; choose a frame-rate budget based on actual measurements.
- The public demo identifies concept art, simulated timings and test contacts accurately.

<!-- pagebreak -->

## 8. Sources and production handoff

Sources checked on 4 October 2026. Character design, palette, timing values, prompts and Nami property names are original proposed specifications. Technical capability references are listed below; consult the current SDK documentation when implementing.

- **A1 - Raster and animation features:** Rive, [Features](https://rive.app/features).
- **A2 - Layered artwork and meshes:** Rive, [Mesh deformation and PSD support](https://rive.app/blog/new-features-released-mesh-deformation-and-psd-support).
- **A3 - Data-driven animation:** Rive, [Getting started with Data Binding](https://rive.app/blog/getting-started-with-data-binding).
- **A4 - React integration:** Rive, [React runtime documentation](https://rive.app/docs/runtimes/react/react).
- **A5 - Transparent desktop window:** Electron, [Custom Window Styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles).
- **A6 - Platform limitations:** Electron, [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window/).
- **A7 - Device availability:** Electron, [powerMonitor](https://www.electronjs.org/docs/latest/api/power-monitor).
- **A8 - Local activation:** Picovoice, [Porcupine documentation](https://picovoice.ai/docs/porcupine/).
- **A9 - Accessible input:** W3C WAI, [Input: typing, writing, and clicking](https://www.w3.org/WAI/people-use-web/tools-techniques/input/).

### Handoff checklist

Deliver the approved master, aligned state assets, editable source where available, the authored animation file if built, state manifest, fallback image, typography and colour tokens, and a short recorded example of each state. Include asset provenance and any licence obligations.

The two generated reference images are embedded in the PDF companion. They establish the intended visual direction and remain distinct from production-ready assets. The workflow document remains authoritative for reminder, appointment and escalation behaviour.
