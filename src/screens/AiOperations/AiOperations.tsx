import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PortalShell } from "../../components/PortalShell";
import type { NavGroup } from "../../components/PortalShell";
import { useAuth } from "../../lib/auth";
import {
  canAdministerPilot,
  canImportSapData,
} from "../../lib/accessControl";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Cog,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Network,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users,
  Wrench,
} from "lucide-react";
import { MaintenanceAiWorkOrderExperience } from "./MaintenanceAiWorkOrderExperience";
import { MaintenanceDashboardExperience } from "./MaintenanceDashboardExperience";

const EngineersSection = lazy(() =>
  import("../Engineers").then((module) => ({ default: module.EngineersSection })),
);
const RequirementsSection = lazy(() =>
  import("../Requirements").then((module) => ({ default: module.RequirementsSection })),
);
const TrainingSection = lazy(() =>
  import("../Training").then((module) => ({ default: module.TrainingSection })),
);
const TrainingProvidersSection = lazy(() =>
  import("../TrainingProviders").then((module) => ({
    default: module.TrainingProvidersSection,
  })),
);
const AiMatchingSection = lazy(() =>
  import("../AiMatching").then((module) => ({ default: module.AiMatchingSection })),
);
const SettingsSection = lazy(() =>
  import("../Settings").then((module) => ({ default: module.SettingsSection })),
);
const SupportSection = lazy(() =>
  import("../Support").then((module) => ({ default: module.SupportSection })),
);
const SapDataImportSection = lazy(() =>
  import("../DataImport").then((module) => ({ default: module.SapDataImportSection })),
);
const DesignSystemSection = lazy(() =>
  import("../DesignSystem").then((module) => ({ default: module.DesignSystemSection })),
);
const CareerSection = lazy(() =>
  import("../Career").then((module) => ({ default: module.CareerSection })),
);
const PilotAdoptionSection = lazy(() =>
  import("../PilotAdoption/PilotAdoptionSection").then((module) => ({
    default: module.PilotAdoptionSection,
  })),
);
const PilotImpactSection = lazy(() =>
  import("../PilotImpact/PilotImpactSection").then((module) => ({
    default: module.PilotImpactSection,
  })),
);
const PilotSetupSection = lazy(() =>
  import("../PilotSetup/PilotSetupSection").then((module) => ({
    default: module.PilotSetupSection,
  })),
);
const SkillsMatrixRouteEntry = lazy(() =>
  import("./SkillsMatrixRouteEntry").then((module) => ({
    default: module.SkillsMatrixRouteEntry,
  })),
);
const ShiftCoverPageEntry = lazy(() =>
  import("../LabourRisk/ShiftCoverPageEntry").then((module) => ({
    default: module.ShiftCoverPageEntry,
  })),
);
const LabourRiskDetailPage = lazy(() =>
  import("../LabourRisk").then((module) => ({ default: module.LabourRiskDetailPage })),
);

const EquipmentSection = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentSection })),
);
const EquipmentOverview = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentOverview })),
);
const EquipmentNotifications = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentNotifications })),
);
const EquipmentWorkOrders = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentWorkOrders })),
);
const EquipmentPMs = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentPMs })),
);
const EquipmentHistory = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentHistory })),
);
const EquipmentSkills = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentSkills })),
);
const EquipmentSpares = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentSpares })),
);
const EquipmentDocuments = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentDocuments })),
);
const EquipmentDocumentViewer = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentDocumentViewer })),
);
const EquipmentAiInsights = lazy(() =>
  import("../Equipment").then((module) => ({ default: module.EquipmentAiInsights })),
);

function RouteLoader(): JSX.Element {
  return (
    <section
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2 text-sm text-slate-400">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-400" aria-hidden="true" />
        Loading Maintenance Manager workspace…
      </span>
    </section>
  );
}

const nav: NavGroup[] = [
  {
    groupLabel: "Operations",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
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
    items: [{ label: "Training Plan", icon: GraduationCap, to: "/training" }],
  },
  {
    groupLabel: "Pilot evidence",
    items: [
      { label: "Pilot Impact", icon: BarChart3, to: "/pilot-impact" },
      { label: "Pilot Adoption", icon: Activity, to: "/pilot-adoption" },
    ],
  },
];

export const AiOperations = (): JSX.Element => {
  const { role, isDemoAdmin } = useAuth();
  const mayAdministerPilot = canAdministerPilot(role, isDemoAdmin);
  const mayImportSapData = canImportSapData(role, isDemoAdmin);

  const secondaryNav = [
    { label: "Support", icon: Headphones, to: "/support" },
    ...(mayAdministerPilot
      ? [{ label: "Pilot Setup", icon: ClipboardCheck, to: "/settings/pilot-setup" }]
      : []),
    ...(mayImportSapData
      ? [{ label: "Data Import", icon: UploadCloud, to: "/settings/data-import" }]
      : []),
    { label: "Settings", icon: Cog, to: "/settings", end: true },
  ];

  return (
    <PortalShell
      homeRoute="/dashboard"
      nav={nav}
      secondaryNav={secondaryNav}
      accentColor="blue"
    >
      <MaintenanceAiWorkOrderExperience>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="dashboard" element={<MaintenanceDashboardExperience />} />
            <Route path="pilot-impact" element={<PilotImpactSection />} />
            <Route path="pilot-adoption" element={<PilotAdoptionSection />} />
            <Route path="skills-matrix" element={<SkillsMatrixRouteEntry />} />
            <Route path="engineers" element={<EngineersSection />} />
            <Route path="career" element={<CareerSection />} />
            <Route path="requirements" element={<RequirementsSection />} />
            <Route path="training" element={<TrainingSection />} />
            <Route path="training-providers" element={<TrainingProvidersSection />} />
            <Route path="ai-matching" element={<AiMatchingSection />} />
            <Route
              path="settings/pilot-setup"
              element={
                mayAdministerPilot ? (
                  <PilotSetupSection />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="settings/data-import"
              element={
                mayImportSapData ? (
                  <SapDataImportSection />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
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
              path="maintenance/labour-risk/shift-cover"
              element={<ShiftCoverPageEntry />}
            />
            <Route
              path="maintenance/labour-risk/:riskType"
              element={<LabourRiskDetailPage />}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </MaintenanceAiWorkOrderExperience>
    </PortalShell>
  );
};
