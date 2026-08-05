# Daily Netlify release policy

Vorta uses **one Netlify production deployment per Europe/London calendar day**.

## Development

- Pull requests and branch commits run GitHub TypeScript, contract, smoke, production-build, performance and local browser checks.
- Deploy Previews and branch deploys are intentionally disabled.
- Product commits and merges do not deploy unless the controlled release marker advances.

## Daily release

- `.github/workflows/netlify-daily-release.yml` checks `main` once each evening and can also be started manually.
- The workflow refuses a second release on the same London date.
- It skips the release when no files other than `ops/netlify-release.json` changed since the previous release source commit.
- It runs the canonical build and performance gates before changing the marker.
- Netlify builds only the marker commit, then the reusable production workflow verifies the exact deployed SHA, Ask Vorta decisions and authenticated browser regression.
- The first controlled release is permitted from 6 August 2026. No additional deployment is requested on 5 August 2026.

Do not use Netlify build hooks, manual CLI deploys or ad-hoc marker edits for routine development. Emergency deployment requires explicit owner approval and must still respect the daily limit.
