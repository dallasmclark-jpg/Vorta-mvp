# Vorta RPC security manifest

The authenticated Vorta Data API surface is controlled by a runtime manifest in `private.vorta_privileged_rpc_allowlist` and a source-controlled invariant summary in `supabase/rpc-security-manifest.json`.

## Current contract

- 61 authenticated-callable public Vorta functions
- 46 reviewed read RPCs
- 15 reviewed mutation RPCs
- 58 intentional `SECURITY DEFINER` wrappers
- 3 `SECURITY INVOKER` equipment-evidence readers
- 0 anonymous-callable Vorta functions
- 0 manifest drift findings

The three invoker readers are:

- `vorta_get_equipment_history(uuid)`
- `vorta_get_equipment_documents(uuid)`
- `vorta_get_equipment_document(uuid,uuid)`

They preserve the existing equipment and document row-level security model rather than bypassing it.

## Adding or changing an RPC

1. Prefer `SECURITY INVOKER` when existing RLS can enforce the required access.
2. Use `SECURITY DEFINER` only when the wrapper genuinely needs controlled privileged access.
3. Set an explicit `search_path` on every client-callable function.
4. Revoke the default `PUBLIC` execute grant before granting only the required roles.
5. Add or update the exact `regprocedure` identity in `private.vorta_privileged_rpc_allowlist` through a migration.
6. Record whether the function is a read or mutation and whether it is an invoker or definer.
7. Update `supabase/rpc-security-manifest.json` when an intentional count changes.
8. Run `npm run test:contracts` and the authenticated backend health gate.
9. Run the Supabase security advisor after applying the migration.

## Drift detection

`private.vorta_get_rpc_security_manifest_drift()` reports:

- authenticated or anonymous functions missing from the manifest
- stale manifest rows
- invoker/definer mismatches
- anonymous execution
- missing fixed search paths
- missing service-role execution
- anonymous-grant contract mismatches

The function is service-role only. `vorta_get_demo_backend_health()` exposes only aggregate counts and marks backend health false whenever drift or anonymous Vorta execution exists.

## Internal helpers

Pure calculation helpers are not public Data API endpoints. The following inherited execute grants are explicitly revoked from `PUBLIC`, `anon`, and `authenticated`:

- `vorta_effective_pm_status(text,date)`
- `vorta_spare_component_risk_points(text,text)`
- `vorta_work_order_is_overdue(text,date)`

Internal database functions and service-role workflows can continue to call them.
