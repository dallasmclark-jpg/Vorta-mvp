import { GlobalMaintenanceAiAssistant } from "./GlobalMaintenanceAiAssistant";

type VortaAiRole =
  | "maintenance-manager"
  | "planner"
  | "engineer"
  | "operator"
  | "production-manager"
  | "contractor";

interface GlobalMaintenanceAiAssistantWithFaultsV2Props {
  role?: VortaAiRole;
  showLauncher?: boolean;
}

/**
 * Compatibility wrapper retained for existing route imports.
 *
 * Ask Vorta now has one conversation, one intent router and one response
 * renderer. Equipment fault history, documents, skills and SME evidence remain
 * available through the specialist tools owned by the main Ask Vorta agent.
 */
export function GlobalMaintenanceAiAssistantWithFaultsV2({
  role = "maintenance-manager",
  showLauncher = true,
}: GlobalMaintenanceAiAssistantWithFaultsV2Props): JSX.Element {
  return (
    <GlobalMaintenanceAiAssistant
      role={role}
      showLauncher={showLauncher}
    />
  );
}
