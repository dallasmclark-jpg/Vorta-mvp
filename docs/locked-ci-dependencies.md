# Locked CI dependencies and actions

Vorta keeps browser-test tooling and release-critical GitHub Actions immutable inside each reviewed change.

## Browser runtime

- `@playwright/test` is an exact development dependency in `package.json` and `package-lock.json`.
- CI installs the repository lockfile with `npm ci`.
- Workflows must not run `npm install --no-save @playwright/test` or otherwise install an untracked browser-test package.
- Chromium remains an explicit workflow step through `npx playwright install --with-deps chromium` so the browser binary and operating-system dependencies are visible in evidence.

## Protected GitHub Actions

The following workflows are release- or pilot-critical and must use immutable 40-character commit SHAs for external actions:

- `.github/workflows/maintenance-manager-quality.yml`
- `.github/workflows/maintenance-manager-production.yml`
- `.github/workflows/vor-048-validation.yml`
- `.github/workflows/vor-049-validation.yml`
- `.github/workflows/vor-051-validation.yml`

The reviewed action commits are recorded beside each `uses:` entry with the compatible major version as a comment.

## Established deployment flow

- Pull requests run the repository validation workflows without requiring a production deployment.
- After an approved change is merged, Netlify automatically builds the merged `main` commit.
- The Netlify build runs the canonical `npm run build` path, including TypeScript, permanent contracts, route smoke tests and performance checks.
- The production verification workflow follows a successful Maintenance Manager quality run on `main`, confirms the exact deployed commit and runs the authenticated production checks.
- Deployment is not restricted by a calendar-date marker or a scheduled daily release workflow.

## Update procedure

1. Open a dedicated dependency-hardening issue and branch.
2. Review the upstream release and security notes.
3. Resolve the desired action tag to its current commit SHA using the upstream GitHub repository.
4. Update the exact package version or immutable action SHA and retain a human-readable version comment.
5. Regenerate `package-lock.json` using Node.js 22 and the repository lockfile version.
6. Run `npm ci`, the VOR-064 contract, the complete contract suite, TypeScript, route smoke, production build, performance and relevant browser gates.
7. Merge through the normal pull-request workflow. Netlify automatically builds the merged `main` commit and production verification checks that exact deployment.

Do not update locked CI dependencies opportunistically inside unrelated product work.
