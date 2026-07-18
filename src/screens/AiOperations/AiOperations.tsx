import { Navigate, Route, Routes } from "react-router-dom";
import { PortalShell } from "../../components/PortalShell";
import type { NavGroup } from "../../components/PortalShell";
import {
  Activity,
  BarChart3,
  ClipboardList,
  Cog,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Network,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users,
  Wrench,
} from "lucide-react";
import { SkillsMatrixSection } from "../SkillsMatrix";
import { EngineersSection } from "../Engineers";
import { RequirementsSection } from "../Requirements";
import { TrainingSection } from "../Training";
import { TrainingProvidersSection } from "../TrainingProviders";
import { AiMatchingSection } from "../AiMatching";
import { SettingsSection } from "../Settings";
import {
  EquipmentSection,
  EquipmentOverview,
  EquipmentNotifications,
  EquipmentWorkOrders,
  EquipmentPMs,
  EquipmentHistory,
  EquipmentSkills,
  EquipmentSpares,
  EquipmentDocuments,
  EquipmentDocumentViewer,
  EquipmentAiInsights,
} from "../Equipment";
import { SupportSection } from "../Support";
import { SapDataImportSection } from "../DataImport";
import { DesignSystemSection } from "../DesignSystem";
import { LabourRiskDetailPage } from "../LabourRisk";
import { CareerSection } from "../Career";
import { PilotAdoptionSection } from "../PilotAdoption/PilotAdoptionSection";
import { PilotImpactSection } from "../PilotImpact/PilotImpactSection";
import { MaintenanceAiWorkOrderExperience } from "./MaintenanceAiWorkOrderExperience";
import { MaintenanceDashboardExperience } from "./MaintenanceDashboardExperience";

const nav: NavGroup[] = [
  {
    groupLabel: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
      { label: "Pilot Impact", icon: BarChart3, to: "/pilot-impact" },
      { label: "Pilot Adoption", icon: Activity, to: "/pilot-adoption" },
      { label: "Equipment", icon: Wrench, to: "/equipment" },
      { label: "AI Matching", icon: Sparkles, to: "/ai-matching" },
    ],
  },
  {
    groupLabel: "Workforce",
    items: [
      { label: "Skills Matrix", icon: Network, to: "/skills-matrix" },
      { label: "Engineers", icon: Users, to: "/engineers" },
      { label: "My Career", icon: TrendingUp, to: "/career" },
      { label: "Requirements", icon: ClipboardList, to: "/requirements" },
    ],
  },
  {
    groupLabel: "Training",
    items: [
      { label: "Training Plan", icon: GraduationCap, to: "/training" },
    ],
  },
];

const secondaryNav = [
  {
    label: "Support",
    icon: Headphones,
    to: "/support",
  },
  {
    label: "Data Import",
    icon: UploadCloud,
    to: "/settings/data-import",
  },
  {
    label: "Settings",
    icon: Cog,
    to: "/settings",
    end: true,
  },
];

export const AiOperations = (): JSX.Element => (
  <PortalShell
    homeRoute="/dashboard"
    nav={nav}
    secondaryNav={secondaryNav}
    accentColor="blue"
  >
    <MaintenanceAiWorkOrderExperience>
      <Routes>
        <Route path="dashboard" element={<MaintenanceDashboardExperience />} />
        <Route path="pilot-impact" element={<PilotImpactSection />} />
        <Route path="pilot-adoption" element={<PilotAdoptionSection />} />
        <Route path="skills-matrix" element={<SkillsMatrixSection />} />
        <Route path="engineers" element={<EngineersSection />} />
        <Route path="career" element={<CareerSection />} />
        <Route path="requirements" element={<RequirementsSection />} />
        <Route path="training" element={<TrainingSection />} />
        <Route path="training-providers" element={<TrainingProvidersSection />} />
        <Route path="ai-matching" element={<AiMatchingSection />} />
        <Route path="settings/data-import" element={<SapDataImportSection />} />
        <Route path="settings" element={<SettingsSection />} />
        <Route path="equipment" element={<EquipmentSection />} />
        <Route path="equipment/:equipmentId/overview" element={<EquipmentOverview />} />
        <Route
          path="equipment/:equipmentId/notifications"
          element={<EquipmentNotifications />}
        />
        <Route
          path="equipment/:equipmentId/work-orders"
          element={<EquipmentWorkOrders />}
        />
        <Route path="equipment/:equipmentId/pms" element={<EquipmentPMs />} />
        <Route path="equipment/:equipmentId/history" element={<EquipmentHistory />} />
        <Route path="equipment/:equipmentId/skills" element={<EquipmentSkills />} />
        <Route path="equipment/:equipmentId/spares" element={<EquipmentSpares />} />
        <Route
          path="equipment/:equipmentId/documents/:documentId"
          element={<EquipmentDocumentViewer />}
        />
        <Route
          path="equipment/:equipmentId/documents"
          element={<EquipmentDocuments />}
        />
        <Route
          path="equipment/:equipmentId/ai-insights"
          element={<EquipmentAiInsights />}
        />
        <Route path="support" element={<SupportSection />} />
        <Route path="design-system" element={<DesignSystemSection />} />
        <Route
          path="maintenance/labour-risk/:riskType"
          element={<LabourRiskDetailPage />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MaintenanceAiWorkOrderExperience>
  </PortalShell>
);
