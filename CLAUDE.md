# CLAUDE.md — non-negotiables for this repo

Arcade Arena: a browser, body-as-controller movement game for NZ school gyms,
operated by Sport Waikato, plus the privacy, identity and measurement floor it
needs to run in real schools. These rules are enforced by tooling and tests, not
just stated here. If you are an agent or a developer working in this repo, treat
each of these as a hard constraint.

## Privacy — stop-the-line

- **Camera frames never leave the device.** No frames, crops, canvas snapshots,
  or raw landmark arrays are transmitted, persisted, or passed to any
  third-party SDK. **No `MediaRecorder` anywhere in the repo.** Only derived
  aggregates — active seconds, movement magnitude, team score — are sent to the
  server. Any code path that could carry pixel data off-device is a stop-the-line
  defect, not a review comment.
- A persistent on-screen indicator reads **"Camera on. Nothing is recorded or
  sent."** whenever the camera is live.
- Enforced by `tooling/eslint-plugin-privacy` (errors, not warnings) and
  `scripts/privacy-audit.mjs` in CI: `no-media-recorder`, `no-frame-exfiltration`
  (`toDataURL`/`toBlob`/`getImageData`/`putImageData` reaching network or
  storage), `no-pii-in-logs`, `no-landmark-persistence`.

## No student PII, at all

- Teams are **classes** ("Room 12", "9 Blue"), never individuals. No student
  accounts, no student names, no individual leaderboards. Only **staff**
  authenticate.
- No participant PII in logs, fixtures, or screenshots — **synthetic data only**
  outside production.

## Access control lives in the database and server code

- Access control lives in **RLS and server code, never in a hidden button.**
  Middleware protects routes as defence in depth only.
- **School is the tenant.** RLS by `school_id` with `FORCE` on every table. A
  school never sees another school's rows. Regional leaderboard participation is
  per-school opt-in and aggregate-only; groups below **n=5 are suppressed**.
- Roles: `sw_admin`, `school_coordinator`, `kaiako`, `researcher`.

## Schema changes

- Any schema change means a **new numbered migration** in `supabase/migrations`
  **plus** updated RLS tests in `supabase/tests/rls_test.sql` passing. Every new
  table must have RLS `FORCE` enabled and a corresponding tenancy test. CI fails
  otherwise.

## Evidence tiers

- Movement records carry a **tier**, and **the client never sets it.** The
  client submits a *claim*; the server assigns the tier after plausibility
  checks. A failed check downgrades the tier and writes to the append-only
  `audit_log` — it never silently drops data.

## Consent as data

- Consent is versioned data (`consent_versions` / `consents`) scoped by **data
  class** (`camera`, `motion`, `survey`). The game refuses to start a session
  unless a matching camera-class consent is active — the check is a **server
  call, not a dismissed modal.** Withdrawal triggers a real cascade.

## Surveys and instruments

- Editing a published survey or instrument **creates a new version** rather than
  mutating it. Every response is stamped with `instrument_key` and
  `instrument_version` so a later wording change can't break a longitudinal
  comparison.

## Original IP only

- Original character design, original music, original voice lines. Do not
  reproduce or imitate any existing children's fitness brand or presenter. All
  visuals drawn in code; no stock art, no non-free fonts.

## Architecture boundaries (so this can be absorbed into `pwatemplate`)

- Motion engine, audio scheduler and scoring live in **`packages/arcade-engine`**
  as framework-agnostic TypeScript with **zero React imports**.
- The React layer lives in **`packages/arcade-react`**. `apps/web` is a thin
  Next.js shell that must not reimplement auth, consent, scoring or reporting.
- Stack: Next.js 15 App Router, React 19, TypeScript, Supabase (Postgres + Auth
  + RLS), Tailwind, zod at every boundary, Vitest for logic packages, Playwright
  for e2e + accessibility. **npm workspaces.** Package namespace `@sw/*`.

## Definition of done

- Do not claim a feature is complete unless the flow is implemented and tested.
- `npm run typecheck`, `npm run test`, `npm run test:db`, `npm run build`,
  `npm run privacy:audit` all green. New privacy rules ship with failing-case
  fixtures proving the rule catches the thing.
- Record anything unfinished honestly in `docs/known-limitations.md`, including
  things you chose not to do.
