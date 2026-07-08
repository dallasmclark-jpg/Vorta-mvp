import { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "../tailwind.css";
import { AuthGate, AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/Toast";
import { DelayedLoader } from "./components/VortaLoadingScreen";

// Eagerly loaded — tiny, needed immediately on every route
import { LoginPage } from "./screens/Login";

// Lazy-loaded — large bundles only needed when navigating to that portal
const AiOperations         = lazy(() => import("./screens/AiOperations").then(m => ({ default: m.AiOperations })));
const EngineerPortal       = lazy(() => import("./screens/EngineerPortal").then(m => ({ default: m.EngineerPortal })));
const ContractorPortal     = lazy(() => import("./screens/ContractorPortal").then(m => ({ default: m.ContractorPortal })));
const ProductionManagerPortal = lazy(() => import("./screens/ProductionManager").then(m => ({ default: m.ProductionManagerPortal })));
const OperatorPortal       = lazy(() => import("./screens/OperatorPortal").then(m => ({ default: m.OperatorPortal })));
const MaintenancePlanner   = lazy(() => import("./screens/MaintenancePlanner").then(m => ({ default: m.MaintenancePlanner })));

createRoot(document.getElementById("app") as HTMLElement).render(
  <BrowserRouter>
    <AuthProvider>
      <AuthGate>
        <ToastProvider>
          <Suspense fallback={<DelayedLoader />}>
            <Routes>
              {/* Login — default entry point */}
              <Route path="/" element={<LoginPage />} />

              {/* /login kept for backward compat (logout redirects here) */}
              <Route path="/login" element={<Navigate to="/" replace />} />

              {/* Legacy redirects — keep old URLs working */}
              <Route path="/engineer-dashboard"    element={<Navigate to="/engineer/dashboard"    replace />} />
              <Route path="/contractor-dashboard"  element={<Navigate to="/contractor/dashboard"  replace />} />

              {/* Portal routes — lazy loaded */}
              <Route path="/engineer/*"   element={<EngineerPortal />} />
              <Route path="/contractor/*" element={<ContractorPortal />} />
              <Route path="/production/*" element={<ProductionManagerPortal />} />
              <Route path="/operator/*"   element={<OperatorPortal />} />
              <Route path="/planner/*"    element={<MaintenancePlanner />} />
              <Route path="/*"            element={<AiOperations />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthGate>
    </AuthProvider>
  </BrowserRouter>,
);
