import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "../tailwind.css";
import { AiOperations } from "./screens/AiOperations";
import { LoginPage } from "./screens/Login";
import { EngineerPortal } from "./screens/EngineerPortal";
import { ContractorPortal } from "./screens/ContractorPortal";
import { ProductionManagerPortal } from "./screens/ProductionManager";
import { OperatorPortal } from "./screens/OperatorPortal";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/Toast";

createRoot(document.getElementById("app") as HTMLElement).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Login — default entry point */}
          <Route path="/" element={<LoginPage />} />

          {/* /login kept for backward compat (logout redirects here) */}
          <Route path="/login" element={<Navigate to="/" replace />} />

          {/* Legacy redirects — keep old URLs working */}
          <Route path="/engineer-dashboard" element={<Navigate to="/engineer/dashboard" replace />} />
          <Route path="/contractor-dashboard" element={<Navigate to="/contractor/dashboard" replace />} />

          {/* Engineer Portal — standalone shell with its own sidebar */}
          <Route path="/engineer/*" element={<EngineerPortal />} />

          {/* Contractor Portal — standalone shell with its own sidebar */}
          <Route path="/contractor/*" element={<ContractorPortal />} />

          {/* Production Manager Portal — standalone shell with its own sidebar */}
          <Route path="/production/*" element={<ProductionManagerPortal />} />

          {/* Operator Portal */}
          <Route path="/operator/*" element={<OperatorPortal />} />

          {/* Maintenance Manager — all sub-routes */}
          <Route path="/*" element={<AiOperations />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
);

