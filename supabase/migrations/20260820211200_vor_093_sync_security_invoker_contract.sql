-- VOR-093
-- Persist the reviewed August 2026 client-RPC security contract that is already
-- active in production: all authenticated public Vorta wrappers execute as
-- SECURITY INVOKER. Privileged implementation details remain behind private or
-- separately guarded functions, while public wrappers retain RLS/site-access
-- enforcement and anonymous execution remains revoked.

DO $migration$
DECLARE
  r record;
  v_function regprocedure;
  v_reviewed integer := 0;
  v_read integer := 0;
  v_mutation integer := 0;
  v_definer integer := 0;
  v_invoker integer := 0;
  v_anon integer := 0;
  v_drift integer := 0;
BEGIN
  FOR r IN
    SELECT allowlist.rpc_identity
    FROM private.vorta_privileged_rpc_allowlist allowlist
    ORDER BY allowlist.rpc_identity
  LOOP
    v_function := to_regprocedure('public.' || r.rpc_identity);
    IF v_function IS NULL THEN
      RAISE EXCEPTION 'Reviewed Vorta RPC is missing: %', r.rpc_identity;
    END IF;

    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', v_function);
  END LOOP;

  UPDATE private.vorta_privileged_rpc_allowlist
  SET security_mode = 'invoker',
      anonymous_execute = false,
      reviewed_migration = 'vor_093_sync_security_invoker_contract',
      reviewed_at = now();

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE allowlist.rpc_class = 'read')::integer,
    count(*) FILTER (WHERE allowlist.rpc_class = 'mutation')::integer
  INTO v_reviewed, v_read, v_mutation
  FROM private.vorta_privileged_rpc_allowlist allowlist;

  SELECT
    count(*) FILTER (WHERE p.prosecdef)::integer,
    count(*) FILTER (WHERE NOT p.prosecdef)::integer,
    count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE'))::integer
  INTO v_definer, v_invoker, v_anon
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.proname LIKE 'vorta_%'
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

  SELECT count(*)::integer
  INTO v_drift
  FROM private.vorta_get_rpc_security_manifest_drift();

  IF v_reviewed <> 76 THEN
    RAISE EXCEPTION 'Reviewed authenticated Vorta RPC count drifted: %', v_reviewed;
  END IF;
  IF v_read <> 55 THEN
    RAISE EXCEPTION 'Reviewed authenticated read RPC count drifted: %', v_read;
  END IF;
  IF v_mutation <> 21 THEN
    RAISE EXCEPTION 'Reviewed authenticated mutation RPC count drifted: %', v_mutation;
  END IF;
  IF v_definer <> 0 THEN
    RAISE EXCEPTION 'Public authenticated SECURITY DEFINER wrapper count must be zero: %', v_definer;
  END IF;
  IF v_invoker <> 76 THEN
    RAISE EXCEPTION 'Public authenticated SECURITY INVOKER wrapper count drifted: %', v_invoker;
  END IF;
  IF v_anon <> 0 THEN
    RAISE EXCEPTION 'Anonymous Vorta RPC execution is not permitted: %', v_anon;
  END IF;
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'RPC security manifest drift is not permitted: %', v_drift;
  END IF;
END
$migration$;
