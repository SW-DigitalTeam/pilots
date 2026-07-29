# pwatemplate — Arcade Arena

A PWA template monorepo for Sport Waikato school-gym pilots. This repo ships
**Arcade Arena**: a camera-driven, controller-free movement game for NZ school
gyms — projector or TV, a laptop webcam, no controllers, run by teachers and
caretakers with no training, on old laptops, on bad wifi, in front of thirty
Year 7–10 students who lose interest in eleven seconds if it feels janky.

Arcade Arena is built as **two packages inside the template**, not a standalone
app, so every future pilot can mount it:

| Package | What it is |
| --- | --- |
| [`packages/arcade-engine`](packages/arcade-engine) | Framework-agnostic TypeScript: pose interpretation, gesture state machines, the audio-clock lookahead scheduler, procedural music, cue rotation, effort scoring, the session orchestrator. **Zero React imports**, so the WebXR starter can use it too. |
| [`packages/react`](packages/react) | The React binding: the `ArcadeArena` component, calibration→gameplay lifecycle, the canvas renderer, three-shape lip sync, MediaPipe capture. |
| [`packages/shell`](packages/shell) | The template platform contract: the data-class **consent** API and the **`cameraPose` ActivityProvider** + its evidence schema. |
| [`packages/shows`](packages/shows) | Three genuinely distinct `ShowConfig` files. |
| [`apps/standard`](apps/standard) | The starter shell that owns consent + the provider and mounts `ArcadeArena`. |

## How a pilot consumes it

```tsx
<ArcadeArena
  show={showConfig}                    // character, music bed, cue bank, palette
  mode="follow"                        // follow | dodge | pop
  team={{ id, label }}                 // class-level, never a student
  consent={shell.consent}              // the shell's consent gate
  onEvidence={(claim) => provider.submit(claim)}
  onSessionEnd={(summary) => {}}
/>
```

Arcade Arena does **not** own auth, consent, scoring persistence, or the
leaderboard. It emits evidence claims through the shell's `cameraPose`
ActivityProvider and lets the shell handle the rest. It **refuses to start** if
the shell hasn't granted a `camera` data-class consent — it calls the consent
API, it does not reimplement it (`ArcadeEngine.requestStart()` returns
`{ ok: false, reason: "no-consent" }`).

## Hard constraints (and how they're enforced)

- **Camera frames never leave the device.** Only derived numbers — active
  seconds, movement magnitude, team score, gesture counts — leave, and only
  through one chokepoint (`summaryToClaim` → the `cameraPose` provider, which
  validates every claim). No `MediaRecorder`, no `toDataURL`/`toBlob`, no
  canvas pixel export anywhere. The privacy audit (`pnpm privacy:audit`) greps
  every shipped file and fails the build on any pixel-egress API; the schema
  validator rejects any claim carrying a forbidden key or a per-student field.
  A **persistent on-screen indicator** — "Camera on. Nothing is recorded or
  sent." — is shown the entire time the camera is live.
- **Original IP only.** Original character design, original procedural music,
  original voice lines. Nothing imitates any existing children's fitness brand
  or presenter. See the three aesthetic directions below.
- **Offline after first load.** A service worker caches the app shell, the pose
  model + wasm, and the audio cue bank; a dropped connection mid-session never
  interrupts audio or gameplay.
- **Nobody reads anything.** No screen needs more than a few words to proceed.

## The calibration model

Distance from the camera must stop mattering, so **everything normalises against
torso length**:

1. **Calibrate first.** A ~5-second stand-still capture establishes each
   player's torso length in normalised image units (shoulder-centroid to
   hip-centroid). Players are *registered* here — which is also what makes a
   bystander walking through frame a non-event: they never registered, so their
   motion is never attributed to a player (see `PlayerTracker`).
2. **Every threshold is a multiple of torso.** A kid at the back of the hall and
   a kid right in front of the lens produce the same numbers for the same
   movement.
3. **Silent recalibration** when the tracked torso drifts >20%.
4. **Derive from stable landmarks.** Hip-centroid vertical velocity for jump;
   hip-centroid horizontal displacement for side-step; **shoulder drop *combined
   with* knee bend** for duck (shoulder height alone would fire on every lean —
   requiring the knee bend is what rejects a lean); wrist-above-shoulder for
   reach. Positions self-baseline via a slow EMA so drift and stance changes
   don't accumulate into false fires.
5. **State machine per gesture, with hysteresis and cooldown.** Each fires once
   on transition; a double-fire is structurally impossible (re-arm requires both
   a release *and* a cooldown). Jump is two-phase — arm on an upward burst, fire
   only when real elevation is confirmed — so a bob never scores a jump.
6. **Detection is decoupled from render.** Detection runs at whatever the
   machine manages (20–30fps target); the game renders at 60fps off the shared
   audio clock. Below 15fps sustained, a **graceful degradation ladder** drops
   capture resolution, then `numPoses`, then to single-player — never a
   technical error.
7. **Seated mode is a first-class input profile**, built alongside standing:
   upper-body landmarks, same gestures, same scoring, same leaderboard.

**Scoring is effort, not skill.** `Movement Points = active seconds × an
intensity multiplier taken purely from movement magnitude`. Nothing rewards
*hitting* a cue — a kid who is uncoordinated but working hard scores like a
natural athlete. This is a deliberate equity decision; gesture counts are
tallied for evidence but never touch the score. Teams are classes ("Room 12",
"9 Blue") — no student names, no individual leaderboards.

## Audio: one clock, two layers

Audio is the interface in a call-and-response game, so it is built to not drift:

- **One clock.** Times are derived from beat/step *indices* via a `Transport`,
  never accumulated from wall-clock ticks — so no drift can build up no matter
  how jittery the scheduling timer is. Everything visual reads the same
  `beatAtTime`, so audio and animation can never desync.
- **Lookahead scheduler.** A 25ms timer queues any event falling inside the next
  100ms window, with sample-accurate `start(when)` calls. Never `setTimeout` or
  `requestAnimationFrame` for audio events.
- **Music is procedural** — oscillators, noise, envelopes — bar-locked at a
  fixed BPM per show, layered so intensity rises without changing tempo. The pad
  spans a whole bar and the next bar's pad begins exactly where the last ended,
  so there is never a restart click.
- **Voice is pre-rendered buffers**, decoded at load and cached by the service
  worker. A synthetic placeholder voice ships so timing and script can be tuned
  before real recordings exist — see the voice script.
- **Cues are anticipatory.** The character calls a move ~one bar (`leadBars`)
  before the scoring window opens, so players can hear, decide, and move.
- **Music ducks under voice** (~6dB, 50ms ramp) and recovers after.
- **Rotation never repeats.** The same praise line never fires twice in a row
  (shuffle-bag per category, even across refills).
- **Lip sync, cheaply.** An `AnalyserNode` on the voice bus drives **three mouth
  shapes** from the amplitude envelope. No viseme system.
- **Bilingual.** English and te reo Māori share one timing grid, so a show
  switches language without retiming. The te reo here is limited to correct core
  phrases; final te reo audio **must** be voiced by a kaiako, never machine-
  generated (see `docs/VOICE_SCRIPT.md`).

## The three shows — distinct directions, not palette swaps

A variant is a `ShowConfig`, not a fork. One engine, a show layer. The default
"friendly rounded mascot on a gradient" is deliberately *not* one of them.

1. **`tarapi-power-up` — Year 7–8. Saturated comic-book pop.** An original
   spiky critter, *Tarapī*, thick outlines, flat vivid fills, speech-burst
   callouts, 128 BPM, silly and high-energy — this age still buys in.
2. **`baseline` — Year 9–10. Rhythm-game / streetwear HUD.** The hard audience,
   where a bright mascot dies on contact. The participation drop here is a
   *social-risk* problem, so the design removes the thing that makes moving feel
   uncool — performing for a mascot — and replaces it with a format teenagers
   already opt into: near-black ground, one electric accent, hard neon geometry,
   a cool crew-MC **silhouette** instead of a face, dry hype-crew voice, and a
   half-time 100 BPM so moves land heavy and it reads as a *game*, not a workout.
3. **`grid` — character-free. Bauhaus / risograph.** For students who find a
   performing character embarrassing, the whole social layer is removed: no
   character, no face, nothing performing at you. A flat off-white ground, three
   primary inks, pure geometric shapes moving on a grid; a spare, neutral count
   instead of praise theatre. Deliberately calm — its own distinct energy.

Every colour cue is paired with a **distinct shape** cue, because projector
colour is unreliable at five metres with the lights on. Elements are enormous,
fills are hard-edged, motion snaps rather than eases.

## The build loop — critics encoded as tests

The adversarial critic pass bars from the brief are encoded as an executable
test suite (`pnpm test`, 155 tests), so a gesture is *proven*, not eyeballed. A
`replay` rig feeds recorded landmark sequences (`packages/arcade-engine/fixtures/*.json`)
through the real engine.

| Critic | Where | What it proves |
| --- | --- | --- |
| Motion | `src/replay/motion.test.ts` | No false positive from lean / turn / bystander; ≥95% true-positive across 20–30fps; no double-fire; <120ms motion-to-response; two-player independence; seated parity. |
| Audio | `src/audio/audio.test.ts` | Drift ≈ 0 across a 5-minute session under jittery ticks; no dropped/duplicated events; no bar-boundary click; praise never repeats consecutively; audio and animation share one clock. |
| Privacy | `src/privacy.test.ts` + `scripts/privacy-audit.mjs` | No pixel-egress API in any shipped file; engine imports no React; evidence is derived numbers only; smuggled landmarks / per-student fields are rejected. |
| Equity | `src/scoring.test.ts`, seated fixtures | Effort scoring rewards a hard-working player like an athlete; seated mode is the same game. |
| Integration | `packages/react/src/ArcadeArena.test.tsx`, `apps/standard` build | Imports cleanly into the standard app; refuses without consent; claims validate against the shell schema; engine has no React. |
| Shows | `packages/shows/src/shows.test.ts` | Three distinct directions; 60+ varied bilingual cues each; colour always paired with shape; each drives a real engine. |

## Running it

```bash
pnpm install
pnpm test           # 155 tests
pnpm typecheck      # tsc -b across all packages
pnpm privacy:audit  # grep for pixel-egress APIs
pnpm dev:standard   # run the starter app (needs a webcam)
node scripts/generate-fixtures.mjs   # regenerate the JSON fixture library
```

To run the real game you need the MediaPipe assets served at
`/mediapipe/pose_landmarker_lite.task` and `/mediapipe/wasm/` and the recorded
cue-bank audio at `/audio/` (both cached by the service worker after first load).

## Deliverables in this repo

- The two packages (`arcade-engine`, `react`) + the shell contract.
- Three `ShowConfig` files (`packages/shows`).
- The landmark fixture library + replay rig (`fixtures/`, `src/replay/`).
- The audio timing test suite.
- This README (calibration model + three aesthetic directions).
- A one-page run sheet — [`docs/RUN_SHEET.md`](docs/RUN_SHEET.md).
- A voice-recording script with timing marks — [`docs/VOICE_SCRIPT.md`](docs/VOICE_SCRIPT.md).
