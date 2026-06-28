import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "../tailwind.css";
import { AiOperations } from "./screens/AiOperations";
import { LoginPage } from "./screens/Login";
import { EngineerDashboardSection } from "./screens/EngineerDashboard";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/Toast";

createRoot(document.getElementById("app") as HTMLElement).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public route — always accessible */}
          <Route path="/login" element={<LoginPage />} />

          {/* Engineer dashboard — standalone, no MM sidebar */}
          <Route
            path="/engineer-dashboard"
            element={
              <main className="min-h-screen w-full overflow-y-auto bg-[#0b0e14] text-white">
                <EngineerDashboardSection />
              </main>
            }
          />

          {/* Maintenance Manager dashboard and all sub-routes
              TODO: add RequireAuth once role-based routing is implemented */}
          <Route path="/*" element={<AiOperations />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
);
