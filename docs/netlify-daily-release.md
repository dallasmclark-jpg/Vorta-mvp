# Daily Netlify release policy

Vorta uses **one Netlify production deployment per Europe/London calendar day**.

## Development

- Pull requests and branch commits run GitHub TypeScript, contract, smoke, production-build, performance and local browser checks.
- Deploy Previews and branch deploys are intentionally disabled.
- Product commits and merges do not deploy unless the controlled daily workflow explicitly triggers the validated release.

## Required Netlify trigger

The repository must contain a GitHub Actions secret named `NETLIFY_BUILD_HOOK_URL`.

- The value is the production build hook created for the `vorta-app` site and the `main` branch.
- The URL must remain a secret. It must not be committed, printed in logs or placed in documentation.
- If the secret is missing, `.github/workflows/netlify-daily-release.yml` fails before changing `ops/netlify-release.json`.
- The workflow does not use an ad-hoc Netlify CLI deployment or embed a raw Netlify API credential.

## Daily release

- `.github/workflows/netlify-daily-release.yml` checks `main` once each evening and can also be started manually.
- It reads the Europe/London date and the exact commit currently served by production.
- It skips when production already serves a release recorded for the current London date.
- It skips when no files other than `ops/netlify-release.json` changed since the previous release source commit.
- It requires the secure build hook, then runs the canonical build and performance gates before changing the marker.
- It commits the dated marker, POSTs the configured Netlify hook exactly once and preserves the trigger response.
- The reusable production workflow waits for the exact release commit, then runs the Ask Vorta backlog decision, all golden decisions and the authenticated browser regression.
- Only after those checks pass does the workflow record the exact deployed commit and completion timestamp in the marker.

## Failed-release recovery

A failed trigger or deployment does not count as a successful production release.

- Recovery is manual through the `recover_failed_release` workflow input.
- Recovery is refused while production already serves a release for the current London date.
- Recovery is also refused until at least **30 minutes** after the preceding trigger, reducing the risk of two builds racing each other.
- The current `main` candidate is revalidated before a recovery marker and trigger are created.
- A second successful deployment on the same London date remains prohibited.

The first controlled release is permitted from 6 August 2026. Emergency deployment still requires explicit owner approval and must preserve the same date, exact-commit and verification controls.
