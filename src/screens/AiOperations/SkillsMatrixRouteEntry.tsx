import { Navigate, useSearchParams } from "react-router-dom";
import { SkillsMatrixSection } from "../SkillsMatrix";

export function SkillsMatrixRouteEntry(): JSX.Element {
  const [searchParams] = useSearchParams();
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

  return <SkillsMatrixSection />;
}
