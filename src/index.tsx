import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "../tailwind.css";
import { AiOperations } from "./screens/AiOperations";
import { LoginPage } from "./screens/Login";
import { EngineerPortal } from "./screens/EngineerPortal";
import { ContractorPortal } from "./screens/ContractorPortal";
import { ProductionManagerPortal } from "./screens/ProductionManager";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/Toast";

function OperatorPlaceholder() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0e14] text-white">
      <span className="select-none font-mono text-4xl font-bold leading-none text-white">&gt;&lt;</span>
      <p className="mt-4 text-base font-semibold text-slate-300">Operator Portal</p>
      <p className="mt-1 text-sm text-slate-500">Coming soon — check back shortly.</p>
      <a href="/login" className="mt-6 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200">
        Back to login
      </a>
    </div>
  );
}

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

          {/* Operator Portal — placeholder until the full portal is built */}
          <Route path="/operator/*" element={<OperatorPlaceholder />} />

          {/* Maintenance Manager dashboard and all sub-routes
              TODO: add RequireAuth once role-based routing is implemented */}
          <Route path="/*" element={<AiOperations />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
);

