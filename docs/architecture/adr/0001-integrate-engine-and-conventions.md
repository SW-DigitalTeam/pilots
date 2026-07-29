# ADR-0001: Integrate the existing motion engine; adopt Next.js + Supabase + npm/@sw conventions

- Status: accepted
- Date: 2026-07-29

## Context

A tested, framework-agnostic Arcade Arena motion engine, audio scheduler,
scoring, three shows, a fixture/replay harness, and a React binding already
existed (pnpm workspaces, `@pwa/*`, a Vite dev app, 155 passing tests). The
production brief calls for the same game plus a privacy/identity/measurement
floor on Next.js 15 + Supabase, npm workspaces, `@sw/*`, and explicitly asks that
we not rewrite working, tested code — and that boundaries be drawn so the game
can later be absorbed into Sport Waikato's `pwatemplate` platform as a package.

## Decision

1. **Integrate, don't rewrite.** Keep the engine/react/shows logic and its tests
   verbatim; change only packaging.
2. **Adopt the platform conventions now**: npm workspaces, rename `@pwa/*` →
   `@sw/*`, and (in a later PR) a Next.js 15 `apps/web` thin shell replacing the
   Vite dev app. The motion engine, audio scheduler and scoring stay in
   `packages/arcade-engine` with zero React imports.
3. **Next.js, for the server — not the sensors.** Browser hardware APIs (camera,
   DeviceMotion, PWA/service worker) are identical under Vite and Next; the game
   runs client-only (`"use client"`, `ssr:false`) either way. Next is chosen
   because the platform floor needs a server: Supabase Auth `hd` OAuth callback,
   RLS-authenticated server queries, the server-side consent gate and
   plausibility validators (route handlers), the retention cron, and reporting.
4. **Database authored for CI.** Migrations, RLS (FORCE), the audit log and the
   pgTAP tenancy suite are written as deliverables and verified in CI against the
   Supabase Postgres image, not against a local DB in the build sandbox.

## Consequences

- The 155 existing tests continue to pass unchanged under npm + `@sw/*`.
- Absorption into `pwatemplate` becomes a move, not a rewrite.
- The DB layer's correctness is proven by CI, not by this repo's local run; this
  is called out in `docs/known-limitations.md`.
- The Vite `apps/standard` remains temporarily as the engine dev harness until
  `apps/web` lands; `dev:app`/`build:app` point at it in the meantime.
