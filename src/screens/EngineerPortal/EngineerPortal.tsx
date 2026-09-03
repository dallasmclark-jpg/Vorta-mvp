import { Navigate, Route, Routes } from "react-router-dom";
import { GlobalMaintenanceAiAssistant } from "../AiOperations/GlobalMaintenanceAiAssistant";
import { usePrimaryAskVortaVisibility } from "../AiOperations/usePrimaryAskVortaVisibility";
import { EngineerAskVortaScreen } from "./EngineerAskVortaScreen";
import {
  EngineerEquipmentDetailScreen,
  EngineerEquipmentScreen,
  EngineerHomeScreen,
  EngineerMyWorkScreen,
  EngineerSpareDetailScreen,
  EngineerWorkOrderDetailScreen,
} from "./EngineerCoreScreens";
import { EngineerDatabaseImages } from "./EngineerDatabaseImages";
import { EngineerPortalShell } from "./EngineerPortalShell";
import { EngineerQrScannerBridge } from "./EngineerQrScannerBridge";
import { EngineerSearchPillStyles } from "./EngineerSearchPillStyles";
import {
  EngineerDocumentsScreen,
  EngineerHandoverScreen,
  EngineerNotificationsScreen,
  EngineerProfileSettingsScreen,
  EngineerSiteAlertsScreen,
} from "./EngineerSecondaryScreens";
import { EngineerSkillDetailScreen, EngineerSkillsScreen } from "./EngineerSkillsScreens";
import { EngineerStoresEquipmentFilter } from "./EngineerStoresEquipmentFilter";

export const EngineerPortal = (): JSX.Element => {
  const isPrimaryAskVortaVisible = usePrimaryAskVortaVisibility();

  return (
    <EngineerPortalShell>
      <EngineerSearchPillStyles />
      <EngineerDatabaseImages />
      <EngineerQrScannerBridge />
      <Routes>
        <Route path="vorta" element={<EngineerAskVortaScreen />} />
        <Route path="home" element={<EngineerHomeScreen />} />
        <Route path="work" element={<EngineerMyWorkScreen />} />
        <Route path="work/:workOrderId" element={<EngineerWorkOrderDetailScreen />} />
        <Route path="equipment" element={<EngineerEquipmentScreen />} />
        <Route path="equipment/:equipmentId" element={<EngineerEquipmentDetailScreen />} />
        <Route path="stores" element={<EngineerStoresEquipmentFilter />} />
        <Route path="stores/:partNumber" element={<EngineerSpareDetailScreen />} />
        <Route path="skills" element={<EngineerSkillsScreen />} />
        <Route path="skills/:skillName" element={<EngineerSkillDetailScreen />} />

        <Route path="handover" element={<EngineerHandoverScreen />} />
        <Route path="documents" element={<EngineerDocumentsScreen />} />
        <Route path="notifications" element={<EngineerNotificationsScreen />} />
        <Route path="alerts" element={<EngineerSiteAlertsScreen />} />
        <Route path="settings" element={<EngineerProfileSettingsScreen />} />

        <Route path="dashboard" element={<Navigate to="/engineer/vorta" replace />} />
        <Route path="training" element={<Navigate to="/engineer/skills" replace />} />
        <Route path="certifications" element={<Navigate to="/engineer/skills" replace />} />
        <Route path="bookings" element={<Navigate to="/engineer/skills" replace />} />
        <Route path="opportunities" element={<Navigate to="/engineer/home" replace />} />
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