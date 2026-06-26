import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";
import { SidebarNavigationSection } from "./sections/SidebarNavigationSection/SidebarNavigationSection";
import { SkillsMatrixSection } from "../SkillsMatrix";
import { EngineersSection } from "../Engineers";
import { RequirementsSection } from "../Requirements";
import { TrainingSection } from "../Training";
import { TrainingProvidersSection } from "../TrainingProviders";

export const AiOperations = (): JSX.Element => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <main className="h-full w-full max-w-full overflow-x-hidden bg-[#0b0e14] text-white">
      <div className="flex h-full w-full max-w-full items-stretch overflow-x-hidden">

        {/* ── Sidebar: icon-only 72px on md+lg, expanded on xl ────────────── */}
        <aside className="hidden shrink-0 md:flex md:w-[72px] lg:w-[72px] xl:w-[220px]">
          <SidebarNavigationSection />
        </aside>

        {/* ── Mobile overlay sidebar ────────────────────────────────────────── */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-50 flex w-64 shrink-0 flex-col">
              <SidebarNavigationSection forceExpanded />
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <section className="flex min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden">
          {/* Mobile top bar with hamburger */}
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-800 bg-[#090b10] px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-mono text-sm font-bold text-white">&gt;&lt;</span>
            <span className="text-sm font-bold tracking-widest text-blue-500">VORTA</span>
          </div>

          <div className="min-w-0 h-full w-full flex-1 overflow-y-auto overflow-x-hidden">
            <div className="min-w-0 w-full max-w-full overflow-x-hidden">
            <Routes>
              <Route path="/" element={<DashboardOverviewSection />} />
              <Route path="/skills-matrix" element={<SkillsMatrixSection />} />
              <Route path="/engineers" element={<EngineersSection />} />
              <Route path="/requirements" element={<RequirementsSection />} />
              <Route path="/training" element={<TrainingSection />} />
              <Route path="/training-providers" element={<TrainingProvidersSection />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
