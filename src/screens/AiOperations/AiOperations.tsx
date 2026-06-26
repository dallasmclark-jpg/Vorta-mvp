import { Navigate, Route, Routes } from "react-router-dom";
import { ScrollArea } from "../../components/ui/scroll-area";
import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";
import { SidebarNavigationSection } from "./sections/SidebarNavigationSection/SidebarNavigationSection";
import { SkillsMatrixSection } from "../SkillsMatrix";

export const AiOperations = (): JSX.Element => {
  return (
    <main className="h-full overflow-hidden bg-[#0b0e14] text-white">
      <div className="flex h-full w-full items-stretch">
        {/* Sidebar — hidden on mobile, visible from lg breakpoint */}
        <aside className="hidden shrink-0 lg:flex lg:w-[17%]">
          <SidebarNavigationSection />
        </aside>
        <section className="min-w-0 w-full flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <Routes>
              <Route path="/" element={<DashboardOverviewSection />} />
              <Route path="/skills-matrix" element={<SkillsMatrixSection />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ScrollArea>
        </section>
      </div>
    </main>
  );
};
