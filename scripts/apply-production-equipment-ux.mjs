import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/screens/Equipment/EquipmentSection.tsx", import.meta.url);
let source = readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  assert.equal(count, 1, `${label}: expected one source match, found ${count}`);
  source = source.replace(before, after);
}

function replaceSection(startMarker, endMarker, replacement, label, fromIndex = 0) {
  const start = source.indexOf(startMarker, fromIndex);
  assert.notEqual(start, -1, `${label}: start marker not found`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${label}: end marker not found`);
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

replaceOnce(
  `import type {\n  EquipmentListItem,\n  EquipmentRecommendedWorkQueue as EquipmentRecommendedWorkQueueType,\n  EquipmentRiskTrendRange,\n  EquipmentRiskTrendSeries,\n} from "./equipmentService";\n`,
  `import type {\n  EquipmentListItem,\n  EquipmentRecommendedWorkQueue as EquipmentRecommendedWorkQueueType,\n  EquipmentRiskTrendRange,\n  EquipmentRiskTrendSeries,\n} from "./equipmentService";\nimport {\n  loadEquipmentEvidenceCoverage,\n  type EquipmentEvidenceCoverage,\n} from "./equipmentEvidenceCoverage";\n`,
  "evidence import",
);

replaceOnce(
  `type EquipmentFilterChip =\n  | "Area"\n  | "At Risk"\n  | "Overdue PMs"\n  | "Calibration Due";\n\nconst FILTER_CHIPS: readonly EquipmentFilterChip[] = [\n  "Area",\n  "At Risk",\n  "Overdue PMs",\n  "Calibration Due",\n];`,
  `type EquipmentFilterChip =\n  | "Area"\n  | "At Risk"\n  | "Overdue PMs"\n  | "Calibration Due"\n  | "Evidence Gaps";\n\ntype EquipmentSortKey = "risk" | "name" | "backlog" | "evidence";\n\nconst FILTER_CHIPS: readonly EquipmentFilterChip[] = [\n  "Area",\n  "At Risk",\n  "Overdue PMs",\n  "Calibration Due",\n  "Evidence Gaps",\n];`,
  "filter and sort types",
);

replaceOnce(
  `  const [calibrationDueOnly, setCalibrationDueOnly] =\n    useState(false);\n  const [reloadKey, setReloadKey] = useState(0);`,
  `  const [calibrationDueOnly, setCalibrationDueOnly] =\n    useState(false);\n  const [evidenceGapsOnly, setEvidenceGapsOnly] = useState(false);\n  const [sortKey, setSortKey] = useState<EquipmentSortKey>("risk");\n  const [evidenceCoverage, setEvidenceCoverage] = useState<\n    Map<string, EquipmentEvidenceCoverage>\n  >(new Map());\n  const [evidenceLoading, setEvidenceLoading] = useState(true);\n  const [evidenceError, setEvidenceError] = useState<string | null>(null);\n  const [reloadKey, setReloadKey] = useState(0);`,
  "Equipment state",
);

replaceOnce(
  `    setLoading(true);\n    setLoadError(null);\n\n    getEquipmentList()`,
  `    setLoading(true);\n    setLoadError(null);\n    setEvidenceLoading(true);\n    setEvidenceError(null);\n\n    getEquipmentList()`,
  "load state setup",
);

const componentStart = source.indexOf("export const EquipmentSection");
assert.notEqual(componentStart, -1, "Equipment component not found");
const loadStart = source.indexOf("    getEquipmentList()", componentStart);
const loadEndMarker = "\n\n    return () => { cancelled = true; };";
replaceSection(
  "    getEquipmentList()",
  loadEndMarker,
  `    getEquipmentList()\n      .then((items) => {\n        if (cancelled) return;\n        setEquipmentList(items);\n        if (items.length > 0) {\n          setExpandedId((current) =>\n            current && items.some((item) => item.id === current) ? current : items[0].id,\n          );\n        } else {\n          setExpandedId("");\n        }\n\n        void loadEquipmentEvidenceCoverage(items.map((item) => item.id))\n          .then((coverage) => {\n            if (!cancelled) setEvidenceCoverage(coverage);\n          })\n          .catch((error: unknown) => {\n            if (cancelled) return;\n            console.warn("Equipment evidence coverage could not be loaded:", error);\n            setEvidenceCoverage(new Map());\n            setEvidenceError(\n              error instanceof Error\n                ? error.message\n                : "Equipment evidence coverage could not be loaded.",\n            );\n          })\n          .finally(() => {\n            if (!cancelled) setEvidenceLoading(false);\n          });\n      })\n      .catch((error) => {\n        if (cancelled) return;\n        console.error("Equipment list load failed:", error);\n        setEquipmentList([]);\n        setExpandedId("");\n        setEvidenceCoverage(new Map());\n        setEvidenceLoading(false);\n        setLoadError("Equipment data could not be loaded. Refresh the page or try again.");\n      })\n      .finally(() => {\n        if (!cancelled) setLoading(false);\n      });`,
  "equipment and evidence loading",
  loadStart,
);

const filteredStart = source.indexOf("  const filtered = useMemo(() => {", componentStart);
replaceSection(
  "  const filtered = useMemo(() => {",
  "  const riskDriverLegend = useMemo(() => {",
  `  const filtered = useMemo(() => {\n    const result = equipmentList.filter((e) => {\n      if (activeArea) {\n        const resolved = resolveBuilding(activeArea);\n\n        if (resolved) {\n          const normalizedBuildingAreas =\n            resolved.areas.map(normalizeAreaKey);\n\n          if (\n            !normalizedBuildingAreas.includes(\n              normalizeAreaKey(e.area),\n            )\n          ) {\n            return false;\n          }\n        } else if (\n          normalizeAreaKey(e.area) !==\n          normalizeAreaKey(activeArea)\n        ) {\n          return false;\n        }\n      }\n      if (\n        atRiskOnly &&\n        e.riskLevel !== "Critical" &&\n        e.riskLevel !== "High"\n      ) {\n        return false;\n      }\n      if (overduePmOnly && e.overduePmCount === 0) {\n        return false;\n      }\n      if (\n        calibrationDueOnly &&\n        e.calibrationOverdueCount === 0\n      ) {\n        return false;\n      }\n      if (\n        evidenceGapsOnly &&\n        evidenceCoverage.get(e.id)?.complete !== false\n      ) {\n        return false;\n      }\n      if (search) {\n        const q = search.toLowerCase();\n        if (\n          !e.name.toLowerCase().includes(q) &&\n          !e.assetNumber.toLowerCase().includes(q) &&\n          !e.area.toLowerCase().includes(q) &&\n          !e.type.toLowerCase().includes(q) &&\n          !e.oem.toLowerCase().includes(q) &&\n          !e.criticality.toLowerCase().includes(q)\n        ) return false;\n      }\n      return true;\n    });\n\n    return result.sort((left, right) => {\n      if (sortKey === "name") {\n        return left.name.localeCompare(right.name);\n      }\n      if (sortKey === "backlog") {\n        const leftBacklog =\n          left.openWorkOrderCount +\n          left.overduePmCount +\n          left.calibrationOverdueCount;\n        const rightBacklog =\n          right.openWorkOrderCount +\n          right.overduePmCount +\n          right.calibrationOverdueCount;\n        return rightBacklog - leftBacklog || right.riskScore - left.riskScore;\n      }\n      if (sortKey === "evidence") {\n        const leftScore = evidenceCoverage.get(left.id)?.score ?? 6;\n        const rightScore = evidenceCoverage.get(right.id)?.score ?? 6;\n        return leftScore - rightScore || right.riskScore - left.riskScore;\n      }\n      return right.riskScore - left.riskScore || left.name.localeCompare(right.name);\n    });\n  }, [\n    equipmentList,\n    activeArea,\n    search,\n    atRiskOnly,\n    overduePmOnly,\n    calibrationDueOnly,\n    evidenceGapsOnly,\n    evidenceCoverage,\n    sortKey,\n  ]);\n\n`,
  "filtered and sorted equipment",
  filteredStart,
);

replaceOnce(
  `  const calibrationDue = filtered.reduce(\n    (total, item) => total + item.calibrationOverdueCount,\n    0,\n  );\n\n  const refreshEquipment`,
  `  const calibrationDue = filtered.reduce(\n    (total, item) => total + item.calibrationOverdueCount,\n    0,\n  );\n\n  const evidenceGapCount =\n    evidenceLoading || evidenceError\n      ? null\n      : filtered.filter(\n          (item) => evidenceCoverage.get(item.id)?.complete === false,\n        ).length;\n\n  const refreshEquipment`,
  "evidence KPI calculation",
);

replaceOnce(
  `    overduePmOnly ||\n    calibrationDueOnly;`,
  `    overduePmOnly ||\n    calibrationDueOnly ||\n    evidenceGapsOnly;`,
  "active filters",
);

replaceOnce(
  `      case "Calibration Due":\n        setCalibrationDueOnly(\n          (current) => !current,\n        );\n        break;\n    }`,
  `      case "Calibration Due":\n        setCalibrationDueOnly(\n          (current) => !current,\n        );\n        break;\n\n      case "Evidence Gaps":\n        if (!evidenceLoading && !evidenceError) {\n          setEvidenceGapsOnly((current) => !current);\n        }\n        break;\n    }`,
  "evidence filter handler",
);

replaceOnce(
  `<section className="flex w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-4 md:px-6 xl:px-8">`,
  `<section\n      className="flex w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-4 md:px-6 xl:px-8"\n      data-vorta-production-equipment-list="true"\n    >`,
  "section trust marker",
);

replaceOnce(
  `      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">`,
  `      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">`,
  "KPI columns",
);

replaceOnce(
  `        <KpiCard label="Calibration Due" value={String(calibrationDue)} />\n      </div>`,
  `        <KpiCard label="Calibration Due" value={String(calibrationDue)} />\n        <KpiCard\n          label="Evidence Gaps"\n          value={\n            evidenceLoading\n              ? "…"\n              : evidenceError\n                ? "—"\n                : String(evidenceGapCount ?? 0)\n          }\n          badgeLabel={\n            evidenceGapCount !== null && evidenceGapCount > 0\n              ? "ACTION"\n              : undefined\n          }\n          badgeClass="bg-[#f59e0b20] text-amber-400"\n        />\n      </div>`,
  "evidence KPI",
);

replaceOnce(
  `      {/* ── Search ──────────────────────────────────────────────────────── */}\n      <div className="relative w-full">\n        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />\n        <input\n          type="text"\n          value={search}\n          onChange={(e) => setSearch(e.target.value)}\n          placeholder="Search equipment, asset number, area, manufacturer or production line..."\n          className="w-full rounded-xl border border-gray-800 bg-[#141820] py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"\n        />\n      </div>`,
  `      {/* ── Search and sort ─────────────────────────────────────────────── */}\n      <div className="flex w-full flex-col gap-3 lg:flex-row">\n        <div className="relative min-w-0 flex-1">\n          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />\n          <input\n            type="text"\n            value={search}\n            onChange={(e) => setSearch(e.target.value)}\n            placeholder="Search equipment, asset number, area, manufacturer or production line..."\n            className="w-full rounded-xl border border-gray-800 bg-[#141820] py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"\n          />\n        </div>\n        <label className="flex min-w-[190px] items-center gap-3 rounded-xl border border-gray-800 bg-[#141820] px-3">\n          <span className="whitespace-nowrap text-xs font-medium text-slate-500">\n            Sort by\n          </span>\n          <select\n            value={sortKey}\n            onChange={(event) =>\n              setSortKey(event.target.value as EquipmentSortKey)\n            }\n            data-vorta-equipment-sort="true"\n            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-200 outline-none"\n            aria-label="Sort equipment"\n          >\n            <option value="risk">Highest risk</option>\n            <option value="backlog">Largest backlog</option>\n            <option value="name">Equipment name</option>\n            <option value="evidence">Evidence gaps</option>\n          </select>\n        </label>\n      </div>`,
  "search and sort controls",
);

replaceOnce(
  `              : chip === "Overdue PMs"\n                  ? overduePmOnly\n                  : calibrationDueOnly;`,
  `              : chip === "Overdue PMs"\n                  ? overduePmOnly\n                  : chip === "Calibration Due"\n                    ? calibrationDueOnly\n                    : evidenceGapsOnly;`,
  "filter active state",
);

replaceOnce(
  `              onClick={() =>\n                handleChipClick(chip)\n              }\n              className={` + "`" + `rounded-full border px-3 py-1 text-xs font-medium transition-colors \${`,
  `              onClick={() =>\n                handleChipClick(chip)\n              }\n              disabled={\n                chip === "Evidence Gaps" &&\n                (evidenceLoading || Boolean(evidenceError))\n              }\n              className={` + "`" + `rounded-full border px-3 py-1 text-xs font-medium transition-colors \${`,
  "filter disabled state",
);

replaceOnce(
  `              setCalibrationDueOnly(false);\n              navigate(`,
  `              setCalibrationDueOnly(false);\n              setEvidenceGapsOnly(false);\n              navigate(`,
  "clear evidence filter",
);

replaceOnce(
  `      </div>\n\n      {/* ── Equipment Table ─────────────────────────────────────────────── */}`,
  `      </div>\n\n      {evidenceError ? (\n        <div\n          role="status"\n          className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-200"\n        >\n          Evidence coverage is unavailable. Risk and backlog records remain available.\n        </div>\n      ) : evidenceGapCount !== null && evidenceGapCount > 0 ? (\n        <div\n          role="status"\n          className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-200"\n        >\n          {evidenceGapCount} {evidenceGapCount === 1 ? "asset has" : "assets have"} incomplete maintenance evidence.\n        </div>\n      ) : null}\n\n      {/* ── Equipment Table ─────────────────────────────────────────────── */}`,
  "evidence status",
);

replaceOnce(
  `            const badge = riskBadgeClass(item.riskLevel);\n            return (`,
  `            const badge = riskBadgeClass(item.riskLevel);\n            const itemEvidence = evidenceCoverage.get(item.id);\n            return (`,
  "row evidence lookup",
);

replaceOnce(
  `                    <span className="mt-0.5 inline-flex w-fit rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400">\n                      {item.type}\n                    </span>\n                  </div>`,
  `                    <span className="mt-0.5 inline-flex w-fit rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400">\n                      {item.type}\n                    </span>\n                    {!evidenceLoading &&\n                      !evidenceError &&\n                      itemEvidence &&\n                      !itemEvidence.complete && (\n                        <span\n                          className="inline-flex w-fit rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"\n                          title={\`\${itemEvidence.componentCount} components · \${itemEvidence.documentCount} documents · \${itemEvidence.faultCodeCount} fault codes · \${itemEvidence.workOrderCount} work orders · \${itemEvidence.maintenanceScheduleCount} maintenance schedules\`}\n                        >\n                          Evidence {itemEvidence.score}/5\n                        </span>\n                      )}\n                  </div>`,
  "row evidence badge",
);

writeFileSync(path, source);
console.log("Production Equipment UX applied.");
