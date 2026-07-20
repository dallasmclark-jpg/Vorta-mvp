## Summary

Describe the problem and the resulting change.

## Scope

- Portal or workflow:
- User role:
- Demo mode, live mode or both:
- Explicitly out of scope:

## Data trust and integrations

- [ ] Active-site isolation is preserved.
- [ ] Missing live evidence fails closed.
- [ ] No demonstration records are presented as verified site evidence.
- [ ] No source-system write-back is implied or introduced.
- [ ] Supabase or RPC permissions are unchanged, or the security impact is documented below.

Security or data notes:

## Regression protection

List the pages, workflows or behaviours that must remain unchanged. Include Shift Cover and Equipment route protection when relevant.

## Validation

- [ ] TypeScript
- [ ] Contract suite
- [ ] Route smoke
- [ ] Production build
- [ ] Relevant authenticated browser tests
- [ ] Visual or responsive regression when UI changed
- [ ] Netlify deploy preview

Exact tested commit SHA:

## Deployment verification

After merge, record the Netlify production deploy ID and confirm its `commit_ref` matches the merged GitHub commit.
