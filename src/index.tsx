import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "../tailwind.css";
import { AiOperations } from "./screens/AiOperations";
import { LoginPage } from "./screens/Login";

createRoot(document.getElementById("app") as HTMLElement).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/*
        TODO: Enable auth guard below once user accounts are provisioned in Supabase Auth.
        Replace <AiOperations /> with <RequireAuth><AiOperations /></RequireAuth>.
        A RequireAuth component should call supabase.auth.getSession() and redirect
        to /login if no active session is found.
      */}
      <Route path="/*" element={<AiOperations />} />
    </Routes>
  </BrowserRouter>,
);
