# Known limitations

Honest status. Updated every PR. If it's here, it is not done — do not treat a
listed item as implemented.

## Done and tested (in the repo now)

- **Motion engine** (`packages/arcade-engine`, framework-agnostic, zero React):
  calibration, gesture state machines (jump/side-step/duck/reach) with
  hysteresis + cooldown, player tracking (bystander rejection), seated profile,
  graceful-degradation ladder. Fixture library (15 recorded JSON sequences) +
  replay harness + motion critic tests.
- **Audio**: index-derived audio clock, lookahead scheduler, procedural music,
  cue-bank rotation, ducking, anticipatory `leadBars`, timing tests (drift ≈ 0
  over a simulated 5-minute session).
- **Effort scoring**, three distinct shows, canvas renderer, 3-shape lip sync,
  MediaPipe capture, persistent camera indicator, offline service worker.
- **Client-side** consent gate + `cameraPose` provider contract + derived-only
  evidence claim schema/validator.
- **Platform floor (PR1)**: `CLAUDE.md`; core migrations `0001`–`0003` (schema,
  RLS FORCE on every table, append-only audit log); pgTAP tenancy suite; the
  migration guard and CI skeleton. npm workspaces + `@sw/*` conventions.

## Not done yet (planned, in PR order)

- **Database is authored, not runtime-verified here.** This sandbox has no
  Postgres, so `supabase test db` (pgTAP) and migrations run in CI, not locally
  in this environment. The SQL is written to the Supabase Postgres image's
  conventions (auth schema, `authenticated`/`anon` roles). Treat green CI as the
  proof, not this repo's local run.
- **Auth** (Google `hd` allowlist, roles, middleware, school onboarding) — not
  implemented. RLS helper functions assume `auth.uid()`; the sign-in flow that
  populates it is a later PR.
- **Consent server gate, withdrawal cascade, retention job, data export** —
  schema exists; the server-side enforcement, scheduled deletion job, and
  coordinator export flow are not built.
- **Server-side tier assignment + plausibility validators** — `movement_entries`
  is tier-aware and defaults to Tier 0; the validators that elevate/downgrade
  and the `kaiakoAttest` provider are not built. Until then nothing elevates a
  tier above 0.
- **Measures** (`vor-2025.1` five-face pulse, `mwys-2024.1` + baselines,
  instrument versioning, reporting export) — not built.
- **Dodge and Pop modes** — only the Follow-style director exists; Dodge/Pop
  game logic and scoring are not implemented.
- **`tooling/eslint-plugin-privacy`** — today privacy is enforced by
  `scripts/privacy-audit.mjs` (grep). The four ESLint rules
  (`no-media-recorder`, `no-frame-exfiltration`, `no-pii-in-logs`,
  `no-landmark-persistence`) with failing-case fixtures are not built; the CI
  `privacy` job runs the grep audit only.
- **`apps/web` (Next.js 15)** — the current app shell is still the Vite
  `apps/standard` used to develop the engine. The Next.js thin shell (with the
  game as a `"use client"`, `ssr:false` dynamic import) replaces it in a later
  PR. `dev:app`/`build:app` point at the Vite app until then.
- **Playwright e2e + accessibility** — CI job is a placeholder; enabled with
  `apps/web`.
- **Docs**: architecture overview, privacy design doc, `GETTING_STARTED.md`,
  further ADRs — pending. This file, `CLAUDE.md`, the run sheet, the voice
  script, and ADR-0001 exist.

## Decisions taken deliberately (not omissions)

- Scoring rewards **effort, not skill** — this is an equity choice, not a bug to
  "fix" during tuning.
- No photo-verification provider will ever be built (a timestamped photo of a
  minor is the worst privacy artifact in the system, and is defeated by
  photographing a screen). Kaiako attestation is the fallback.
