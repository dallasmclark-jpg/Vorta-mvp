# Vorta MVP

Vorta is a maintenance and reliability intelligence platform for manufacturing sites. The current pilot is centred on the Maintenance Manager portal and combines equipment risk, labour resilience, work-order evidence, calibration status, spares exposure, skills coverage and Ask Vorta troubleshooting.

This repository is the Vorta application, not a generic generated starter. Production changes are expected to preserve site isolation, read-only source-system assumptions and truth-safe handling of unavailable evidence.

## Pilot scope

The primary release boundary is the Maintenance Manager portal, including:

- site and equipment risk intelligence
- Equipment Overview, Notifications, Work Orders, Calibrations, History, Skills, Spares, Documents and AI Insights
- Shift Cover and labour-risk workflows
- Skills Matrix and training evidence
- Ask Vorta evidence links and troubleshooting context

SAP and other site systems are treated as read-only sources for the MVP. Vorta must not imply that a transaction was written back to a source system unless a future integration explicitly supports it.

## Technology

- React 18 and TypeScript
- Vite
- Tailwind CSS and Radix UI primitives
- Supabase authentication, Postgres, RPCs and Edge Functions
- Netlify continuous deployment
- Playwright browser and responsive regression tests

## Local setup

### Prerequisites

- Node.js 22
- npm
- access to an appropriate Supabase project when testing authenticated or live data

### Install and run

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The local application is normally available at `http://localhost:5173`.

Do not commit `.env.local`, passwords, service-role keys or other private credentials. Client configuration belongs in local or deployment environment variables.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL. HTTPS is required outside local development. |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase client key. Never substitute a service-role key. |
| `VITE_VORTA_DATA_MODE` | `demo`, `live` or `unavailable`. |
| `VORTA_E2E_EMAIL` | Authenticated browser-test account. |
| `VORTA_E2E_PASSWORD` | Browser-test password. Keep this secret. |
| `VORTA_E2E_BASE_URL` | Optional existing deployment URL for Playwright. When omitted, Playwright starts the local Vite server. |

See `.env.example` for the complete local test configuration.

## Data trust modes

Vorta deliberately distinguishes between demonstration data and verified site evidence:

- `demo`: demonstration fallbacks may be used where the relevant workflow permits them.
- `live`: only authorised, site-scoped evidence may be shown. Missing or failed evidence must fail closed rather than silently displaying demo values.
- `unavailable`: operational evidence is withheld.

Production builds validate the configured mode before deployment. Missing production configuration is not treated as live.

## Quality checks

Run the complete local release check with:

```bash
npm run check
```

Individual checks are available when diagnosing a failure:

```bash
npm run typecheck
npm run test:contracts
npm run test:smoke
npm run test:browser
```

The contract runner prints each named contract separately. A focused subset can be selected with a case-insensitive filter:

```bash
npm run test:contracts -- equipment
```

Install Chromium before the first local browser run:

```bash
npx playwright install chromium
```

Authenticated browser tests also require the `VORTA_E2E_*` variables from `.env.example`.

## Delivery workflow

1. Start from the latest `main` commit.
2. Use a focused `agent/<description>` branch.
3. Keep changes within the requested portal and avoid broad redesigns or unrelated refactors.
4. Run the relevant contracts, TypeScript check, smoke tests and browser regressions.
5. Merge through a pull request only after the exact head commit is green.
6. Verify that Netlify production serves the merged commit SHA.

`main` is continuously deployed to `https://vorta-app.netlify.app`.

## Architecture and operational documentation

- [Development and release guide](docs/development-and-release.md)
- [Equipment live service boundaries](docs/equipment-live-service-boundaries.md)
- [RPC security manifest](docs/rpc-security-manifest.md)

New live Equipment readers should normally be added to focused modules such as `equipmentLiveTrust.ts` or `equipmentPilotEvidence.ts`, not to the broad legacy compatibility service.

## Reporting work

Use the repository issue templates for bugs and improvements. Include the affected portal, data mode, user role, source evidence and regression scope. Pull requests should describe what changed, what was deliberately protected and which checks passed.
