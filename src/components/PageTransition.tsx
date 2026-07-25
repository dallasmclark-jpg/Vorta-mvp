import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ThemeControl } from "./ThemeControl";

interface PageTransitionProps {
  children: React.ReactNode;
}

function mobileRouteLabel(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.includes("/maintenance/labour-risk/shift-cover")) return "Shift Cover";
  if (pathname.startsWith("/equipment/")) return "Equipment";
  if (pathname === "/equipment") return "Equipment";
  if (pathname === "/skills-matrix") return "Skills Matrix";
  if (pathname === "/engineers") return "Engineers";
  if (pathname === "/requirements") return "Requirements";
  if (pathname === "/training") return "Training";
  if (pathname === "/training-providers") return "Training Providers";
  if (pathname === "/ai-matching") return "Capability Matching";
  if (pathname === "/career") return "Workforce Development";
  if (pathname === "/pilot-impact" || pathname === "/pilot-adoption") return "Pilot Evidence";
  if (pathname === "/settings/pilot-setup") return "Pilot Setup";
  if (pathname === "/settings/data-import") return "Data Import";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/support") return "Support";
  return "Maintenance Manager";
}

export const PageTransition = ({ children }: PageTransitionProps): JSX.Element => {
  const { pathname } = useLocation();
  const isSettingsPage = pathname.split("/").includes("settings");

  useEffect(() => {
    const mobileTopBar = document.querySelector<HTMLElement>(
      '[data-vorta-portal-shell="true"] > section > div.md\\:hidden',
    );
    if (!mobileTopBar) return;

    mobileTopBar.dataset.vortaMobilePageTitle = mobileRouteLabel(pathname);
    return () => {
      delete mobileTopBar.dataset.vortaMobilePageTitle;
    };
  }, [pathname]);

  return (
    <>
      <div key={pathname} className="min-w-0 w-full max-w-full overflow-x-hidden">
        {children}
      </div>
      {isSettingsPage ? <ThemeControl /> : null}
    </>
  );
};
