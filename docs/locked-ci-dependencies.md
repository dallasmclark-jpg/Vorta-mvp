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
- `.github/workflows/netlify-daily-release.yml`
- `.github/workflows/vor-048-validation.yml`
- `.github/workflows/vor-049-validation.yml`
- `.github/workflows/vor-051-validation.yml`

The reviewed action commits are recorded beside each `uses:` entry with the compatible major version as a comment.

## Update procedure

1. Open a dedicated dependency-hardening issue and branch.
2. Review the upstream release and security notes.
3. Resolve the desired action tag to its current commit SHA using the upstream GitHub repository.
4. Update the exact package version or immutable action SHA and retain a human-readable version comment.
5. Regenerate `package-lock.json` using Node.js 22 and the repository lockfile version.
6. Run `npm ci`, the VOR-064 contract, the complete contract suite, TypeScript, route smoke, production build, performance and relevant browser gates.
7. Merge through the normal deploy-free pull-request workflow. Production remains governed by the single daily Netlify release marker.

Do not update locked CI dependencies opportunistically inside unrelated product work.
