import { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import "../tailwind.css";
import {
  AuthGate,
  AuthProvider,
  RequireRole,
} from "./lib/auth";
import { ToastProvider } from "./components/Toast";
import {
  DelayedLoader,
} from "./components/VortaLoadingScreen";
import {
  VortaErrorBoundary,
  VortaRouteErrorBoundary,
} from "./components/VortaErrorBoundary";
import {
  installFrontendErrorTelemetry,
} from "./lib/frontendErrorTelemetry";

import { LoginPage } from "./screens/Login";
import {
  AuthCallbackPage,
} from "./screens/Login/AuthCallbackPage";
import {
  ResetPasswordPage,
} from "./screens/Login/ResetPasswordPage";

const AiOperations = lazy(() =>
  import("./screens/AiOperations").then(
    (module) => ({
      default: module.AiOperations,
    }),
  ),
);

const EngineerPortal = lazy(() =>
  import("./screens/EngineerPortal").then(
    (module) => ({
      default: module.EngineerPortal,
    }),
  ),
);

const ContractorPortal = lazy(() =>
  import("./screens/ContractorPortal").then(
    (module) => ({
      default: module.ContractorPortal,
    }),
  ),
);

const ProductionManagerPortal = lazy(() =>
  import("./screens/ProductionManager").then(
    (module) => ({
      default:
        module.ProductionManagerPortal,
    }),
  ),
);

const OperatorPortal = lazy(() =>
  import("./screens/OperatorPortal").then(
    (module) => ({
      default: module.OperatorPortal,
    }),
  ),
);

const MaintenancePlanner = lazy(() =>
  import("./screens/MaintenancePlanner").then(
    (module) => ({
      default: module.MaintenancePlanner,
    }),
  ),
);

installFrontendErrorTelemetry();

createRoot(
  document.getElementById("app") as HTMLElement,
).render(
  <VortaErrorBoundary scope="application">
    <BrowserRouter>
      <AuthProvider>
        <AuthGate>
          <ToastProvider>
            <Suspense
              fallback={<DelayedLoader />}
            >
              <Routes>
                <Route
                  path="/"
                  element={<LoginPage />}
                />

                <Route
                  path="/login"
                  element={
                    <Navigate
                      to="/"
                      replace
                    />
                  }
                />

                <Route
                  path="/auth/callback"
                  element={
                    <AuthCallbackPage />
                  }
                />

                <Route
                  path="/reset-password"
                  element={
                    <ResetPasswordPage />
                  }
                />

                <Route
                  path="/engineer-dashboard"
                  element={
                    <Navigate
                      to="/engineer/dashboard"
                      replace
                    />
                  }
                />

                <Route
                  path="/contractor-dashboard"
                  element={
                    <Navigate
                      to="/contractor/dashboard"
                      replace
                    />
                  }
                />

                <Route
                  path="/engineer/*"
                  element={
                    <RequireRole role="engineer">
                      <VortaRouteErrorBoundary>
                        <EngineerPortal />
                      </VortaRouteErrorBoundary>
                    </RequireRole>
                  }
                />

                <Route
                  path="/contractor/*"
                  element={
                    <RequireRole
                      role={[
                        "contractor_admin",
                        "contractor_engineer",
                      ]}
                    >
                      <VortaRouteErrorBoundary>
                        <ContractorPortal />
                      </VortaRouteErrorBoundary>
                    </RequireRole>
                  }
                />

                <Route
                  path="/production/*"
                  element={
                    <RequireRole
                      role="production_manager"
                    >
                      <VortaRouteErrorBoundary>
                        <ProductionManagerPortal />
                      </VortaRouteErrorBoundary>
                    </RequireRole>
                  }
                />

                <Route
                  path="/operator/*"
                  element={
                    <RequireRole role="operator">
                      <VortaRouteErrorBoundary>
                        <OperatorPortal />
                      </VortaRouteErrorBoundary>
                    </RequireRole>
                  }
                />

                <Route
                  path="/planner/*"
                  element={
                    <RequireRole
                      role="maintenance_planner"
                    >
                      <VortaRouteErrorBoundary>
                        <MaintenancePlanner />
                      </VortaRouteErrorBoundary>
                    </RequireRole>
                  }
                />

                <Route
                  path="/*"
                  element={
                    <RequireRole
                      role={[
                        "maintenance_manager",
                        "site_admin",
                        "reliability_engineer",
                      ]}
                    >
                      <VortaRouteErrorBoundary>
                        <AiOperations />
                      </VortaRouteErrorBoundary>
                    </RequireRole>
                  }
                />
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  </VortaErrorBoundary>,
);
