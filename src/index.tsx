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
          {/* Public route — always accessible */}
          <Route path="/login" element={<LoginPage />} />

          {/* Legacy redirect — keep old URL working */}
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

          {/* Maintenance Manager dashboard and all sub-routes
              TODO: add RequireAuth once role-based routing is implemented */}
          <Route path="/*" element={<AiOperations />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
);

