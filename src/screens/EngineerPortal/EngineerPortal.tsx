import { CalendarDays } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { GlobalMaintenanceAiAssistant } from "../AiOperations/GlobalMaintenanceAiAssistant";
import { usePrimaryAskVortaVisibility } from "../AiOperations/usePrimaryAskVortaVisibility";
import { EngineerAskVortaScreen } from "./EngineerAskVortaScreen";
import { EngineerBottomNavStyles } from "./EngineerBottomNavStyles";
import { EngineerCalendarAiBridge } from "./EngineerCalendarAiBridge";
import { EngineerDatabaseImages } from "./EngineerDatabaseImages";
import { EngineerEquipmentCompetencyScreen } from "./EngineerEquipmentCompetencyScreen";
import {
  EngineerEquipmentDetailScreen,
  EngineerEquipmentScreen,
  EngineerSpareDetailScreen,
  EngineerStoresScreen,
} from "./EngineerEquipmentLiveScreens";
import {
  ENGINEER_PRIMARY_NAV,
  ENGINEER_SECONDARY_NAV,
  EngineerPortalShell,
} from "./EngineerPortalShell";
import { EngineerProfileActivityTimeline } from "./EngineerProfileActivityTimeline";
import { EngineerQrScannerBridge } from "./EngineerQrScannerBridge";
import { EngineerRotaCalendarEnhancer } from "./EngineerRotaCalendarEnhancer";
import { EngineerRotaCompactStyles } from "./EngineerRotaCompactStyles";
import { EngineerRotaScreen } from "./EngineerRotaScreen";
import { EngineerSearchPillStyles } from "./EngineerSearchPillStyles";
import {
  EngineerDocumentsScreen,
  EngineerHandoverScreen,
  EngineerNotificationsScreen,
  EngineerProfileSettingsScreen,
  EngineerSiteAlertsScreen,
} from "./EngineerSecondaryScreens";
import {
  EngineerSkillDetailScreen,
  EngineerSkillsScreen,
} from "./EngineerSkillsLiveScreens";
import { EngineerVortaSelectBridge } from "./EngineerVortaSelectBridge";
import {
  EngineerMyWorkScreen,
  EngineerWorkOrderDetailScreen,
} from "./EngineerWorkLiveScreens";

const engineerNavByPath = new Map(
  [...ENGINEER_PRIMARY_NAV, ...ENGINEER_SECONDARY_NAV].map((item) => [item.to, item]),
);

const rotaNavItem = engineerNavByPath.get("/engineer/rota") ?? {
  label: "Rota",
  to: "/engineer/rota",
  icon: CalendarDays,
};
engineerNavByPath.set("/engineer/rota", rotaNavItem);

const primaryNavOrder = [
  "/engineer/work",
  "/engineer/equipment",
  "/engineer/vorta",
  "/engineer/stores",
  "/engineer/documents",
];
const secondaryNavOrder = [
  "/engineer/handover",
  "/engineer/rota",
  "/engineer/skills",
  "/engineer/notifications",
  "/engineer/alerts",
  "/engineer/settings",
];

ENGINEER_PRIMARY_NAV.splice(
  0,
  ENGINEER_PRIMARY_NAV.length,
  ...primaryNavOrder.flatMap((path) => {
    const item = engineerNavByPath.get(path);
    return item ? [item] : [];
  }),
);
ENGINEER_SECONDARY_NAV.splice(
  0,
  ENGINEER_SECONDARY_NAV.length,
  ...secondaryNavOrder.flatMap((path) => {
    const item = engineerNavByPath.get(path);
    return item ? [item] : [];
  }),
);

export const EngineerPortal = (): JSX.Element => {
  const isPrimaryAskVortaVisible = usePrimaryAskVortaVisibility();

  return (
    <EngineerPortalShell>
      <EngineerSearchPillStyles />
      <EngineerBottomNavStyles />
      <EngineerRotaCompactStyles />
      <EngineerDatabaseImages />
      <EngineerQrScannerBridge />
      <EngineerRotaCalendarEnhancer />
      <EngineerCalendarAiBridge />
      <EngineerVortaSelectBridge />
      <Routes>
        <Route path="vorta" element={<EngineerAskVortaScreen />} />
        <Route path="home" element={<Navigate to="/engineer/vorta" replace />} />
        <Route path="work" element={<EngineerMyWorkScreen />} />
        <Route path="work/:workOrderId" element={<EngineerWorkOrderDetailScreen />} />
        <Route path="equipment" element={<EngineerEquipmentScreen />} />
        <Route path="equipment/:equipmentId" element={<EngineerEquipmentDetailScreen />} />
        <Route path="stores" element={<EngineerStoresScreen />} />
        <Route path="stores/:partNumber" element={<EngineerSpareDetailScreen />} />
        <Route path="skills" element={<EngineerSkillsScreen />} />
        <Route
          path="skills/equipment/:equipmentId"
          element={<EngineerEquipmentCompetencyScreen />}
        />
        <Route path="skills/:skillName" element={<EngineerSkillDetailScreen />} />

        <Route path="handover" element={<EngineerHandoverScreen />} />
        <Route path="rota" element={<EngineerRotaScreen />} />
        <Route path="documents" element={<EngineerDocumentsScreen />} />
        <Route path="notifications" element={<EngineerNotificationsScreen />} />
        <Route path="alerts" element={<EngineerSiteAlertsScreen />} />
        <Route
          path="settings"
          element={
            <>
              <EngineerProfileSettingsScreen />
              <EngineerProfileActivityTimeline />
            </>
          }
        />

        <Route path="dashboard" element={<Navigate to="/engineer/vorta" replace />} />
        <Route path="training" element={<Navigate to="/engineer/skills" replace />} />
        <Route path="certifications" element={<Navigate to="/engineer/skills" replace />} />
        <Route path="bookings" element={<Navigate to="/engineer/skills" replace />} />
        <Route path="opportunities" element={<Navigate to="/engineer/vorta" replace />} />
        <Route path="ai-recommendations" element={<Navigate to="/engineer/vorta" replace />} />
        <Route path="career-path" element={<Navigate to="/engineer/skills" replace />} />
        <Route path="*" element={<Navigate to="/engineer/vorta" replace />} />
      </Routes>

      <GlobalMaintenanceAiAssistant
        role="engineer"
        showLauncher={!isPrimaryAskVortaVisible}
      />
    </EngineerPortalShell>
  );
};
