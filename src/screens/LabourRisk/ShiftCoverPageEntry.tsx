import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { LiveShiftCoverPage } from "./LiveShiftCoverPage";

export function ShiftCoverPageEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));

  return (
    <div className="contents" data-vorta-shift-cover-mode={dataMode}>
      <LiveShiftCoverPage dataMode={dataMode} />
    </div>
  );
}
