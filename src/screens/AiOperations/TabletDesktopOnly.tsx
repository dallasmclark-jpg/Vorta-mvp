import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export function TabletDesktopOnly({
  children,
  fallbackRoute = "/settings",
}: {
  children: ReactNode;
  fallbackRoute?: string;
}): JSX.Element {
  const isPhone = useMediaQuery("(max-width: 767px)");

  return isPhone
    ? <Navigate to={fallbackRoute} replace />
    : <>{children}</>;
}
