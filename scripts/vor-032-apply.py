from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(
            f"{path}: expected one replacement, found {count}: {old[:120]!r}"
        )
    target.write_text(content.replace(old, new, 1))


dashboard = "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"
labour = "src/screens/AiOperations/sections/DashboardOverviewSection/LabourRiskSection.tsx"
contracts = "scripts/run-contract-suite.mjs"

replace_once(
    dashboard,
    'import { LabourRiskSection } from "./LabourRiskSection";\n',
    'import { LabourRiskSection } from "./LabourRiskSection";\n'
    'import { BiggestReductionOpportunity } from "./RiskOpportunityCards";\n',
)

replace_once(
    dashboard,
    '''                    <div>
                      <div className="mb-3 flex items-center justify-between">''',
    '''                    <BiggestReductionOpportunity
                      plan={riskReductionPlan}
                      onNavigate={navigate}
                    />

                    <div>
                      <div className="mb-3 flex items-center justify-between">''',
)

replace_once(
    dashboard,
    '''        activeScopeArea={activeScopeArea}
        onNavigate={navigate}
      />''',
    '''        activeScopeArea={activeScopeArea}
        riskReductionPlan={riskReductionPlan}
        onNavigate={navigate}
      />''',
)

replace_once(
    labour,
    '''  RiskDashboardLabourCard,
  RiskDashboardScope,
} from "../../../Equipment/equipmentService";
import { RiskMeter } from "./RiskMeter";''',
    '''  RiskDashboardLabourCard,
  RiskDashboardScope,
  SiteRiskReductionPlan,
} from "../../../Equipment/equipmentService";
import { RiskMeter } from "./RiskMeter";
import { CriticalSpareRiskCard } from "./RiskOpportunityCards";''',
)

replace_once(
    labour,
    '''  activeScopeLabel: string;
  activeScopeArea: string | null;
  onNavigate: (path: string) => void;''',
    '''  activeScopeLabel: string;
  activeScopeArea: string | null;
  riskReductionPlan: SiteRiskReductionPlan | null;
  onNavigate: (path: string) => void;''',
)

replace_once(
    labour,
    '''  activeScopeLabel,
  activeScopeArea,
  onNavigate,''',
    '''  activeScopeLabel,
  activeScopeArea,
  riskReductionPlan,
  onNavigate,''',
)

replace_once(
    labour,
    '''          {isSiteRiskScope ? "Labour Risk" : `${activeScopeLabel} Labour Risk`}''',
    '''          {isSiteRiskScope
            ? "Spares & Labour Risks"
            : `${activeScopeLabel} Spares & Labour Risks`}''',
)

replace_once(
    labour,
    '''        ))}
      </div>
    </section>''',
    '''        ))}
      </div>

      <CriticalSpareRiskCard
        plan={riskReductionPlan}
        onNavigate={onNavigate}
      />
    </section>''',
)

replace_once(
    contracts,
    '''  ["VOR-019 engineer summary filters", "scripts/vor-019-engineer-summary-filters-contracts.mjs"],''',
    '''  ["VOR-019 engineer summary filters", "scripts/vor-019-engineer-summary-filters-contracts.mjs"],
  ["VOR-032 dashboard critical spares", "scripts/vor-032-dashboard-critical-spares-contracts.mjs"],''',
)

print("VOR-032 focused dashboard patch applied")
