import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "../tailwind.css";
import { AiOperations } from "./screens/AiOperations";
import { LoginPage } from "./screens/Login";
import { AuthProvider, RequireAuth } from "./lib/auth";

createRoot(document.getElementById("app") as HTMLElement).render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        {/* Public route — always accessible */}
        <Route path="/login" element={<LoginPage />} />

        {/* All dashboard routes are protected — unauthenticated users are redirected to /login */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AiOperations />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  </BrowserRouter>,
);
