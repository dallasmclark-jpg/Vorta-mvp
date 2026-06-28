import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "../tailwind.css";
import { AiOperations } from "./screens/AiOperations";
import { LoginPage } from "./screens/Login";
import { EngineerDashboardSection } from "./screens/EngineerDashboard";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { ToastProvider } from "./components/Toast";

createRoot(document.getElementById("app") as HTMLElement).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public route — always accessible */}
          <Route path="/login" element={<LoginPage />} />

          {/* Engineer-facing dashboard — standalone, no MM sidebar */}
          <Route
            path="/engineer-dashboard"
            element={
              <RequireAuth>
                <main className="min-h-screen w-full overflow-y-auto bg-[#0b0e14] text-white">
                  <EngineerDashboardSection />
                </main>
              </RequireAuth>
            }
          />

          {/* All Maintenance Manager routes — protected */}
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AiOperations />
              </RequireAuth>
            }
          />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
);
