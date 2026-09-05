import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { EquipmentCompetencyReviewPanel } from "../EngineerPortal/EquipmentCompetencyReviewPanel";
import { SkillsMatrixSection } from "../SkillsMatrix";

const REVIEW_ROLES = new Set([
  "vorta_admin",
  "site_admin",
  "maintenance_manager",
  "reliability_engineer",
]);

export function SkillsMatrixRouteEntry(): JSX.Element {
  const [searchParams] = useSearchParams();
  const { role, siteContext } = useAuth();
  const risk = searchParams.get("risk")?.trim().toLowerCase();

  if (risk === "shift-cover") {
    const destination = new URLSearchParams();
    const area = searchParams.get("area")?.trim();
    if (area) {
      destination.set("scope", "area");
      destination.set("area", area);
    }
    const query = destination.toString();
    return (
      <Navigate
        to={`/maintenance/labour-risk/shift-cover${query ? `?${query}` : ""}`}
        replace
      />
    );
  }

  const canReviewEquipmentCompetency = Boolean(
    role && REVIEW_ROLES.has(role),
  );

  return (
    <>
      <SkillsMatrixSection />
      {canReviewEquipmentCompetency ? (
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-5 md:px-6 xl:px-8">
          <EquipmentCompetencyReviewPanel
            siteId={siteContext?.siteId ?? null}
            enabled
          />
        </div>
      ) : null}
    </>
  );
}
