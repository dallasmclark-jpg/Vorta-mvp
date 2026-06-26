import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../tailwind.css";
import { AiOperations } from "./screens/AiOperations";

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <AiOperations />
    </BrowserRouter>
  </StrictMode>,
);
