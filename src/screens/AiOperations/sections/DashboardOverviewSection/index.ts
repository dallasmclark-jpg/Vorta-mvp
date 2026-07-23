import {
  Fragment,
  createElement,
} from "react";
import {
  DashboardOverviewSection as DashboardOverviewSectionBase,
} from "./DashboardOverviewSection";
import {
  MobileRiskScopeSelector,
} from "./MobileRiskScopeSelector";

export const DashboardOverviewSection = (): JSX.Element =>
  createElement(
    Fragment,
    null,
    createElement(
      DashboardOverviewSectionBase,
    ),
    createElement(
      MobileRiskScopeSelector,
    ),
  );
