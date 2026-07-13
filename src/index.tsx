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
import {
  supabaseConfigurationError,
} from "./lib/supabaseClient";

import { LoginPage } from "./screens/Login";
import {
  AuthCallbackPage,
} from "./screens/Login/AuthCallbackPage";
import {
  ResetPasswordPage,
} from "./screens/Login/ResetPasswordPage";

function VortaConfigurationFailure({
  message,
}: {
  message: string;
}): JSX.Element {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#0b0f14] p-5 text-slate-100 sm:p-8"
      role="alert"
      aria-live="assertive"
    >
      <section className="w-full max-w-xl overflow-hidden rounded-2xl border border-red-500/30 bg-[#121821] shadow-2xl shadow-black/40">
        <div className="border-b border-slate-800 bg-[#10161e] px-6 py-5 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-400">
            Vorta deployment notice
          </p>

          <h1 className="mt-2 text-xl font-semibold text-slate-50">
            Vorta could not start
          </h1>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
          <p className="text-sm leading-6 text-slate-300">
            The secure Vorta data connection has not been configured correctly for this deployment.
          </p>

          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3">
            <p className="text-xs font-medium text-red-200">
              Configuration check
            </p>

            <p className="mt-1 text-xs leading-5 text-red-100/75">
              {message}
            </p>
          </div>

          <div className="rounded-xl border border-slate-700/70 bg-[#0d131b] px-4 py-3">
            <p className="text-xs font-medium text-slate-300">
              Deployment administrator
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Netlify environment settings, then redeploy Vorta.
            </p>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            No environment-variable values or credentials have been displayed.
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121821]"
          >
            Retry Vorta
          </button>
        </div>
      </section>
    </main>
  );
}

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

const appElement =
  document.getElementById(
    "app",
  );

if (!appElement) {
  throw new Error(
    "Vorta application root element is missing.",
  );
}

const appRoot =
  createRoot(appElement);

if (
  supabaseConfigurationError
) {
  appRoot.render(
    <VortaConfigurationFailure
      message={
        supabaseConfigurationError
      }
    />,
  );
} else {
  installFrontendErrorTelemetry();

  appRoot.render(
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
}
