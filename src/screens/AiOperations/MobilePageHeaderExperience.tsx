import { useLocation } from "react-router-dom";
import { usePortalMobileHeaderTitle } from "../../components/PortalShell";

const PAGE_PROFILES: Array<{
  matches: (pathname: string) => boolean;
  title: string;
}> = [
  { matches: (pathname) => pathname === "/dashboard", title: "Dashboard" },
  { matches: (pathname) => pathname === "/shift-handover", title: "Shift Handover" },
  { matches: (pathname) => /^\/equipment(?:\/|$)/.test(pathname), title: "Equipment" },
  { matches: (pathname) => pathname === "/skills-matrix", title: "Capability" },
  { matches: (pathname) => pathname === "/engineers", title: "Engineers" },
  { matches: (pathname) => pathname === "/requirements", title: "Requirements" },
  { matches: (pathname) => pathname === "/training", title: "Training" },
  { matches: (pathname) => pathname === "/training-providers", title: "Training Providers" },
  { matches: (pathname) => pathname === "/career", title: "Development" },
  {
    matches: (pathname) => pathname === "/pilot-impact" || pathname === "/pilot-adoption",
    title: "Pilot Evidence",
  },
  { matches: (pathname) => pathname === "/support", title: "Support" },
  { matches: (pathname) => pathname === "/settings", title: "Settings" },
  {
    matches: (pathname) => pathname.includes("/maintenance/labour-risk/shift-cover"),
    title: "Shift Cover",
  },
  {
    matches: (pathname) => pathname.includes("/maintenance/labour-risk/"),
    title: "Labour Risk",
  },
];

function fallbackTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "Dashboard";
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function MobilePageHeaderExperience(): null {
  const location = useLocation();
  const title =
    PAGE_PROFILES.find(({ matches }) => matches(location.pathname))?.title ??
    fallbackTitle(location.pathname);

  usePortalMobileHeaderTitle(title);
  return null;
}
