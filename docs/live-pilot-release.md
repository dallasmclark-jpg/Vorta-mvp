# Live pilot release boundary

## Purpose

The public `vorta-app` production alias remains a demonstration environment. Real site evidence must be exposed only through a controlled read-only pilot deployment.

## Supported deployment targets

A build may use `VITE_VORTA_DATA_MODE=live` only when one of these conditions is true:

1. Netlify is building the `pilot-live` branch as a branch deployment.
2. Netlify is building a dedicated project named `vorta-pilot` in production context.

Both targets must also provide `VORTA_LIVE_PILOT_APPROVED=true`. The build fails closed when these conditions are not met.

## Release procedure

1. Merge a green pilot-hardening pull request into `main`.
2. Create or fast-forward the `pilot-live` branch from the exact approved `main` commit.
3. Confirm the selected Supabase project contains the intended pilot site and active user-site grants.
4. Confirm every live evidence Edge Function is deployed with JWT verification enabled.
5. Confirm the stable pilot origin is accepted by the secured evidence functions.
6. Confirm the Netlify branch deployment reports `ready` and its `commit_ref` equals the approved GitHub commit.
7. Run the authenticated live responsive browser suite against the branch URL.
8. Record the commit, deployment ID, site ID, organisation ID and test result in the pilot release evidence.

## Safety rules

- Do not switch the public `vorta-app` production context to live mode.
- Do not introduce demonstration fallback data into the `pilot-live` branch.
- Do not expose write controls unless the corresponding transaction is persisted, authorised and auditable.
- Do not approve a pilot build when backend health, recovery evidence or site access is incomplete.
- Roll back by moving `pilot-live` to the last approved commit or disabling the branch deployment. The public demo remains unaffected.
