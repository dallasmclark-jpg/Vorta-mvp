import { supabase } from "./supabaseClient";

const REFRESH_RPC = "vorta_refresh_and_get_operational_dashboard";
const SNAPSHOT_RPC = "vorta_get_operational_dashboard_snapshot";
const WORK_PLAN_REFRESH_RPC = "vorta_refresh_risk_work_plan";

let explicitRefreshRequested = false;
let allowNextWorkPlanRefresh = false;
let activeInstallations = 0;
let originalRpc: typeof supabase.rpc | null = null;
let guardedRpc: typeof supabase.rpc | null = null;

export function markExplicitRiskIntelligenceRefresh(): void {
  explicitRefreshRequested = true;
}

export function installMaintenanceDashboardSnapshotGuard(): () => void {
  activeInstallations += 1;

  if (!originalRpc) {
    const boundRpc = supabase.rpc.bind(supabase) as typeof supabase.rpc;
    originalRpc = boundRpc;

    guardedRpc = ((
      functionName: string,
      args?: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => {
      if (functionName === REFRESH_RPC) {
        const shouldRecalculate = explicitRefreshRequested;
        explicitRefreshRequested = false;
        allowNextWorkPlanRefresh = shouldRecalculate;

        return boundRpc(
          shouldRecalculate ? REFRESH_RPC : SNAPSHOT_RPC,
          args as never,
          options as never,
        );
      }

      if (functionName === WORK_PLAN_REFRESH_RPC) {
        if (allowNextWorkPlanRefresh) {
          allowNextWorkPlanRefresh = false;
          return boundRpc(
            functionName as never,
            args as never,
            options as never,
          );
        }

        return Promise.resolve({
          data: 1,
          error: null,
        }) as unknown as ReturnType<typeof supabase.rpc>;
      }

      return boundRpc(
        functionName as never,
        args as never,
        options as never,
      );
    }) as typeof supabase.rpc;

    (supabase as { rpc: typeof supabase.rpc }).rpc = guardedRpc;
  }

  return () => {
    activeInstallations = Math.max(0, activeInstallations - 1);
    explicitRefreshRequested = false;
    allowNextWorkPlanRefresh = false;

    if (
      activeInstallations === 0 &&
      originalRpc &&
      guardedRpc &&
      supabase.rpc === guardedRpc
    ) {
      (supabase as { rpc: typeof supabase.rpc }).rpc = originalRpc;
      originalRpc = null;
      guardedRpc = null;
    }
  };
}
