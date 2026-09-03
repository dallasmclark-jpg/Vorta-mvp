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
  EngineerUtilityIcons,
  EngineerUtilityScreen,
  EngineerWorkOrderDetailScreen,
} from "./EngineerCoreScreens";
import { EngineerDatabaseImages } from "./EngineerDatabaseImages";
import { EngineerPortalShell } from "./EngineerPortalShell";
import { EngineerQrScannerBridge } from "./EngineerQrScannerBridge";
import { EngineerSkillDetailScreen, EngineerSkillsScreen } from "./EngineerSkillsScreens";
import { EngineerStoresEquipmentFilter } from "./EngineerStoresEquipmentFilter";
import { ProfileSettingsSection } from "./ProfileSettingsSection";

export const EngineerPortal = (): JSX.Element => {
  const isPrimaryAskVortaVisible = usePrimaryAskVortaVisibility();

  return (
    <EngineerPortalShell>
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

        <Route
          path="handover"
          element={
            <EngineerUtilityScreen
              title="Shift Handover"
              subtitle="Open breakdowns, watch items and Vorta-native handover notes for the next shift."
              icon={EngineerUtilityIcons.handover}
              snagId="ENG-012"
            />
          }
        />
        <Route
          path="documents"
          element={
            <EngineerUtilityScreen
              title="Documents"
              subtitle="Manuals, SOPs, drawings and maintenance instructions, with equipment context taking priority."
              icon={EngineerUtilityIcons.documents}
              snagId="ENG-011"
            />
          }
        />
        <Route
          path="notifications"
          element={
            <EngineerUtilityScreen
              title="Notifications"
              subtitle="Assigned work, skill assessments, certificate expiry and relevant equipment intelligence."
              icon={EngineerUtilityIcons.notifications}
              snagId="ENG-017"
            />
          }
        />
        <Route
          path="alerts"
          element={
            <EngineerUtilityScreen
              title="Site Alerts"
              subtitle="Engineer-relevant equipment, skills, PM and spares risk without the full management dashboard."
              icon={EngineerUtilityIcons.alerts}
              snagId="ENG-013"
            />
          }
        />
        <Route path="settings" element={<ProfileSettingsSection />} />

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