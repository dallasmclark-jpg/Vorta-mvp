# Development and release guide

## Purpose

This guide describes the minimum workflow for changing the Vorta Maintenance Manager pilot without weakening data trust, site isolation or regression protection.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Configure the public Supabase client values and an explicit data mode.
3. Install exactly the lockfile dependencies with `npm ci`.
4. Start Vite with `npm run dev`.

Node.js 22 is the supported local and CI runtime.

## Data modes

### Demo

`VITE_VORTA_DATA_MODE=demo` permits approved demonstration fallbacks. It is intended for product development and controlled demonstrations, not as evidence that a live site integration is healthy.

### Live

`VITE_VORTA_DATA_MODE=live` requires authorised, site-scoped evidence. Readers must not replace unavailable live evidence with optimistic percentages, records from another site or legacy demo rows.

### Unavailable

`VITE_VORTA_DATA_MODE=unavailable` withholds operational evidence. Production also falls back to this state when the data mode is missing or invalid.

## Local checks

### TypeScript

```bash
npm run typecheck
```

### Contract suite

```bash
npm run test:contracts
```

Contracts are registered in `scripts/run-contract-suite.mjs`. The runner executes each contract in a separate Node process, prints a named result and reports every failure at the end.

A focused subset can be selected using one or more case-insensitive terms:

```bash
npm run test:contracts -- equipment
npm run test:contracts -- equipment accessibility
```

A contract file must be added to the runner manifest when it becomes part of the production quality gate.

### Route smoke

```bash
npm run test:smoke
```

### Browser tests

```bash
npx playwright install chromium
npm run test:browser
```

When `VORTA_E2E_BASE_URL` is absent, Playwright starts Vite on `127.0.0.1:4173`. Authenticated suites require the `VORTA_E2E_*` configuration documented in `.env.example`.

### Full build check

```bash
npm run check
```

This writes exact build metadata, runs TypeScript, contracts and route smoke, then creates the Vite production bundle.

## Pull-request rules

- Start from the latest `main` commit.
- Use a focused branch named `agent/<description>`.
- Do not combine unrelated portal, backend and design changes.
- State whether the change affects demo mode, live mode or both.
- Identify any source-system write assumptions. The MVP is read-only unless a future integration explicitly says otherwise.
- Protect Shift Cover, Equipment routes and active-site isolation with existing regression tests.
- Do not weaken or rewrite tests merely to make a behavioural regression pass.

The pull-request template records the intended scope, data-trust impact, tests and deployment verification.

## CI and deployment

The Maintenance Manager quality gate includes:

- TypeScript
- contract tests
- route smoke tests
- production build
- authenticated browser regression
- visual regression
- live responsive Equipment and Shift Cover regression

Additional focused workflows protect accessibility, Equipment UX, risk contracts, RPC security and other hardened areas.

After a pull request is green on its exact head commit:

1. Squash merge into `main`.
2. Wait for Netlify continuous deployment.
3. Confirm that the production deploy is `ready`.
4. Confirm that the Netlify `commit_ref` equals the merged GitHub commit SHA.
5. Check the deployment validation report for secret-scan findings.

A successful pull-request preview does not prove that production is serving the merged commit.

## Security and configuration

- Never commit passwords, service-role keys, private tokens or production `.env` files.
- The frontend uses a public Supabase client key. A service-role key must never be placed in a `VITE_*` variable.
- Production Supabase URLs must use HTTPS.
- Anonymous and authenticated RPC access is governed by the reviewed RPC security manifest.
- New privileged functions require explicit review, fixed search paths and least-privilege grants.

See `docs/rpc-security-manifest.md` for the database function contract.

## Service boundaries

New live Equipment readers belong in focused live modules. `equipmentService.ts` remains a compatibility surface and should not receive new domains by default.

A future extraction from the compatibility service must move a complete domain with its types, mappings, readers, consumers and contracts. Moving functions merely to reduce the line count is not an architectural improvement.
