import { readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function write(path, content) {
  writeFileSync(resolve(root, path), content);
}

function replaceOnce(content, before, after, label) {
  const first = content.indexOf(before);
  if (first < 0) throw new Error(`VOR-025 patch target missing: ${label}`);
  if (content.indexOf(before, first + before.length) >= 0) {
    throw new Error(`VOR-025 patch target is not unique: ${label}`);
  }
  return content.slice(0, first) + after + content.slice(first + before.length);
}

// Service contract: carry the selected period and retain each item's source shift window.
{
  const path = "src/screens/ShiftHandover/shiftHandoverService.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    `export type ShiftHandoverDiscipline =\n  | "mechanical"\n  | "electrical"\n  | "controls"\n  | "facilities";\n`,
    `export type ShiftHandoverDiscipline =\n  | "mechanical"\n  | "electrical"\n  | "controls"\n  | "facilities";\n\nexport type ShiftHandoverReviewHours = 12 | 24 | 36 | 48 | 96;\n\nconst REVIEW_HOURS = new Set<number>([12, 24, 36, 48, 96]);\n\nexport function isShiftHandoverReviewHours(\n  value: unknown,\n): value is ShiftHandoverReviewHours {\n  return REVIEW_HOURS.has(Number(value));\n}\n`,
    "service review period type",
  );
  content = replaceOnce(
    content,
    `  lastActivityAt: string | null;\n  latestConfirmationText: string | null;`,
    `  lastActivityAt: string | null;\n  handoverWindowStart: string;\n  handoverWindowEnd: string;\n  latestConfirmationText: string | null;`,
    "service item handover window fields",
  );
  content = replaceOnce(
    content,
    `    mode: "previous" | "latest";\n  };`,
    `    mode: "previous" | "latest";\n    reviewHours: ShiftHandoverReviewHours;\n  };`,
    "service snapshot review hours",
  );
  content = replaceOnce(
    content,
    `    lastActivityAt: stringValue(row.lastActivityAt) || null,\n    latestConfirmationText: stringValue(row.latestConfirmationText) || null,`,
    `    lastActivityAt: stringValue(row.lastActivityAt) || null,\n    handoverWindowStart: stringValue(row.handoverWindowStart),\n    handoverWindowEnd: stringValue(row.handoverWindowEnd),\n    latestConfirmationText: stringValue(row.latestConfirmationText) || null,`,
    "service item window parsing",
  );
  content = replaceOnce(
    content,
    `      label: stringValue(window.label),\n      mode: window.mode === "latest" ? "latest" : "previous",\n    },`,
    `      label: stringValue(window.label),\n      mode: window.mode === "latest" ? "latest" : "previous",\n      reviewHours: isShiftHandoverReviewHours(window.reviewHours)\n        ? Number(window.reviewHours) as ShiftHandoverReviewHours\n        : 12,\n    },`,
    "service window parsing",
  );
  content = replaceOnce(
    content,
    `export async function loadShiftHandoverSnapshot(\n  dataMode: VortaDataMode,\n  refresh = false,\n): Promise<ShiftHandoverSnapshot> {`,
    `export async function loadShiftHandoverSnapshot(\n  dataMode: VortaDataMode,\n  reviewHours: ShiftHandoverReviewHours = 12,\n  refresh = false,\n): Promise<ShiftHandoverSnapshot> {`,
    "service loader signature",
  );
  content = replaceOnce(
    content,
    `      windowMode: dataMode === "demo" ? "latest" : "previous",\n      limit: 100,`,
    `      windowMode: dataMode === "demo" ? "latest" : "previous",\n      reviewHours,`,
    "service request body",
  );
  write(path, content);
}

// Shared responsive page: one selector, filtered summaries, date grouping and persistent state.
{
  const path = "src/screens/ShiftHandover/ShiftHandoverSection.tsx";
  let content = read(path);
  content = replaceOnce(
    content,
    `import { useNavigate } from "react-router-dom";`,
    `import { useNavigate, useSearchParams } from "react-router-dom";`,
    "page router imports",
  );
  content = replaceOnce(
    content,
    `  loadShiftHandoverSnapshot,\n  type ShiftHandoverDiscipline,`,
    `  isShiftHandoverReviewHours,\n  loadShiftHandoverSnapshot,\n  type ShiftHandoverDiscipline,`,
    "page service function import",
  );
  content = replaceOnce(
    content,
    `  type ShiftHandoverItem,\n  type ShiftHandoverSnapshot,`,
    `  type ShiftHandoverItem,\n  type ShiftHandoverReviewHours,\n  type ShiftHandoverSnapshot,`,
    "page service type import",
  );
  content = replaceOnce(
    content,
    `type SortMode = "priority" | "breakdown" | "recent";\n\nconst MODE_PRESENTATION`,
    `type SortMode = "priority" | "breakdown" | "recent";\ntype ActivityGroup = {\n  key: string;\n  label: string | null;\n  items: ShiftHandoverItem[];\n};\n\nconst REVIEW_STORAGE_KEY = "vorta.shift-handover.review-period";\nconst REVIEW_PERIOD_OPTIONS: Array<{\n  value: ShiftHandoverReviewHours;\n  label: string;\n}> = [\n  { value: 12, label: "Last 12 hours" },\n  { value: 24, label: "Last 24 hours" },\n  { value: 36, label: "Last 36 hours" },\n  { value: 48, label: "Last 48 hours" },\n  { value: 96, label: "Last 4 days" },\n];\n\nfunction reviewPeriodLabel(reviewHours: ShiftHandoverReviewHours): string {\n  return REVIEW_PERIOD_OPTIONS.find((option) => option.value === reviewHours)?.label\n    ?? "Last 12 hours";\n}\n\nfunction reviewPeriodHeading(reviewHours: ShiftHandoverReviewHours): string {\n  if (reviewHours === 12) return "Previous shift activity for Last 12 hours";\n  if (reviewHours === 96) return "Activity from the last 4 days";\n  return \`Activity from the last \${reviewHours} hours\`;\n}\n\nfunction reviewPeriodEmptyState(reviewHours: ShiftHandoverReviewHours): string {\n  return reviewHours === 96\n    ? "No handover activity recorded in the last 4 days."\n    : \`No handover activity recorded in the last \${reviewHours} hours.\`;\n}\n\nfunction localDateParts(value: string, timeZone: string): {\n  year: string;\n  month: string;\n  day: string;\n} {\n  const parts = new Intl.DateTimeFormat("en-GB", {\n    timeZone,\n    year: "numeric",\n    month: "2-digit",\n    day: "2-digit",\n  }).formatToParts(new Date(value));\n  const map = new Map(parts.map((part) => [part.type, part.value]));\n  return {\n    year: map.get("year") ?? "0000",\n    month: map.get("month") ?? "00",\n    day: map.get("day") ?? "00",\n  };\n}\n\nfunction localDateKey(value: string, timeZone: string): string {\n  const parts = localDateParts(value, timeZone);\n  return \`\${parts.year}-\${parts.month}-\${parts.day}\`;\n}\n\nfunction previousLocalDateKey(value: string, timeZone: string): string {\n  const parts = localDateParts(value, timeZone);\n  const previous = new Date(Date.UTC(\n    Number(parts.year),\n    Number(parts.month) - 1,\n    Number(parts.day) - 1,\n  ));\n  return [\n    String(previous.getUTCFullYear()).padStart(4, "0"),\n    String(previous.getUTCMonth() + 1).padStart(2, "0"),\n    String(previous.getUTCDate()).padStart(2, "0"),\n  ].join("-");\n}\n\nfunction activityDateLabel(\n  value: string,\n  referenceEnd: string,\n  timeZone: string,\n): string {\n  const key = localDateKey(value, timeZone);\n  if (key === localDateKey(referenceEnd, timeZone)) return "Today";\n  if (key === previousLocalDateKey(referenceEnd, timeZone)) return "Yesterday";\n  return new Intl.DateTimeFormat("en-GB", {\n    timeZone,\n    weekday: "long",\n    day: "numeric",\n    month: "long",\n  }).format(new Date(value));\n}\n\nfunction summariseItems(\n  items: ShiftHandoverItem[],\n): ShiftHandoverSnapshot["summary"] {\n  return {\n    total: items.length,\n    ongoing: items.filter((item) => item.status !== "completed").length,\n    completed: items.filter((item) => item.status === "completed").length,\n    waitingOnParts: items.filter((item) => item.status === "waiting_on_parts").length,\n    externalContractor: items.filter((item) => item.status === "external_contractor").length,\n    unavailableEquipment: items.filter(\n      (item) => item.breakdownMinutes > 0 && item.status !== "completed",\n    ).length,\n    totalBreakdownMinutes: items.reduce(\n      (sum, item) => sum + item.breakdownMinutes,\n      0,\n    ),\n    sparesUsed: items.reduce((sum, item) => sum + item.sparesUsed.length, 0),\n  };\n}\n\nconst MODE_PRESENTATION`,
    "page review helpers",
  );
  content = replaceOnce(
    content,
    `<div className="rounded-xl border border-gray-800 bg-[#141820] p-4">`,
    `<div\n      className="rounded-xl border border-gray-800 bg-[#141820] p-4"\n      data-vorta-shift-handover-metric={label.toLowerCase().replace(/\\s+/g, "-")}\n    >`,
    "metric test hook",
  );
  content = replaceOnce(
    content,
    `  const modePresentation = MODE_PRESENTATION[dataMode];\n  const compactDetail = useMediaQuery("(max-width: 1279px)");\n\n  const [snapshot, setSnapshot]`,
    `  const modePresentation = MODE_PRESENTATION[dataMode];\n  const compactDetail = useMediaQuery("(max-width: 1279px)");\n  const [searchParams, setSearchParams] = useSearchParams();\n  const [reviewHours, setReviewHours] = useState<ShiftHandoverReviewHours>(() => {\n    const queryValue = searchParams.get("review");\n    if (isShiftHandoverReviewHours(queryValue)) return Number(queryValue) as ShiftHandoverReviewHours;\n    const storedValue = typeof window !== "undefined"\n      ? window.sessionStorage.getItem(REVIEW_STORAGE_KEY)\n      : null;\n    return isShiftHandoverReviewHours(storedValue)\n      ? Number(storedValue) as ShiftHandoverReviewHours\n      : 12;\n  });\n\n  const [snapshot, setSnapshot]`,
    "page review state",
  );
  content = replaceOnce(
    content,
    `      const next = await loadShiftHandoverSnapshot(dataMode, refresh);`,
    `      const next = await loadShiftHandoverSnapshot(dataMode, reviewHours, refresh);`,
    "page loader call",
  );
  content = replaceOnce(
    content,
    `  }, [dataMode, siteContext?.siteId]);`,
    `  }, [dataMode, reviewHours, siteContext?.siteId]);`,
    "page loader dependencies",
  );
  content = replaceOnce(
    content,
    `  useEffect(() => {\n    setScopeValue("all");\n  }, [scopeMode]);\n\n  const filteredItems`,
    `  useEffect(() => {\n    setScopeValue("all");\n  }, [scopeMode]);\n\n  const changeReviewPeriod = (value: string): void => {\n    if (!isShiftHandoverReviewHours(value)) return;\n    const next = Number(value) as ShiftHandoverReviewHours;\n    const nextParams = new URLSearchParams(searchParams);\n    nextParams.set("review", String(next));\n    setSearchParams(nextParams, { replace: true });\n    if (typeof window !== "undefined") {\n      window.sessionStorage.setItem(REVIEW_STORAGE_KEY, String(next));\n    }\n    if (next > 12) setSortMode("recent");\n    setSelectedId(null);\n    setDetailOpen(false);\n    setReviewHours(next);\n  };\n\n  const filteredItems`,
    "page review handler",
  );
  content = replaceOnce(
    content,
    `        if (sortMode === "breakdown") return b.breakdownMinutes - a.breakdownMinutes;\n        if (sortMode === "recent") return new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime();`,
    `        if (reviewHours > 12 || sortMode === "recent") {\n          return new Date(b.lastActivityAt ?? 0).getTime()\n            - new Date(a.lastActivityAt ?? 0).getTime();\n        }\n        if (sortMode === "breakdown") return b.breakdownMinutes - a.breakdownMinutes;`,
    "page longer period ordering",
  );
  content = replaceOnce(
    content,
    `  }, [criticality, discipline, query, scopeMode, scopeValue, snapshot?.items, sortMode, status]);\n\n  const selectedItem = snapshot?.items.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;`,
    `  }, [criticality, discipline, query, reviewHours, scopeMode, scopeValue, snapshot?.items, sortMode, status]);\n\n  const filteredSummary = useMemo(\n    () => summariseItems(filteredItems),\n    [filteredItems],\n  );\n\n  const activityGroups = useMemo<ActivityGroup[]>(() => {\n    if (!snapshot || reviewHours === 12) {\n      return [{ key: "review-period", label: null, items: filteredItems }];\n    }\n\n    const ordered = [...filteredItems].sort(\n      (a, b) => new Date(b.lastActivityAt ?? 0).getTime()\n        - new Date(a.lastActivityAt ?? 0).getTime(),\n    );\n    const grouped = new Map<string, ShiftHandoverItem[]>();\n    for (const item of ordered) {\n      const activityAt = item.lastActivityAt ?? snapshot.window.start;\n      const key = localDateKey(activityAt, snapshot.site.timezone);\n      const current = grouped.get(key) ?? [];\n      current.push(item);\n      grouped.set(key, current);\n    }\n\n    return [...grouped.entries()]\n      .sort(([left], [right]) => right.localeCompare(left))\n      .map(([key, items]) => ({\n        key,\n        label: activityDateLabel(\n          items[0]?.lastActivityAt ?? snapshot.window.start,\n          snapshot.window.end,\n          snapshot.site.timezone,\n        ),\n        items,\n      }));\n  }, [filteredItems, reviewHours, snapshot]);\n\n  const selectedItem = filteredItems.find((item) => item.id === selectedId)\n    ?? filteredItems[0]\n    ?? null;`,
    "page filtered summary and date groups",
  );
  content = replaceOnce(
    content,
    `                   value={sortMode}\n                   onChange={(event) => setSortMode(event.target.value as SortMode)}\n                   className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60"`,
    `                   value={reviewHours > 12 ? "recent" : sortMode}\n                   onChange={(event) => setSortMode(event.target.value as SortMode)}\n                   disabled={reviewHours > 12}\n                   className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-60"`,
    "page sort lock for grouped periods",
  );
  content = replaceOnce(
    content,
    `            <MetricCard label="Handover items" value={String(snapshot.summary.total)} detail="Confirmed this shift" icon={Wrench} />\n            <MetricCard label="Ongoing" value={String(snapshot.summary.ongoing)} detail="Needs incoming action" icon={Timer} tone="text-blue-300" />\n            <MetricCard label="Completed" value={String(snapshot.summary.completed)} detail="Returned or closed" icon={CheckCircle2} tone="text-emerald-300" />\n            <MetricCard label="Waiting parts" value={String(snapshot.summary.waitingOnParts)} detail="Open material need" icon={Boxes} tone="text-amber-300" />\n            <MetricCard label="Contractor" value={String(snapshot.summary.externalContractor)} detail="External support" icon={HardHat} tone="text-violet-300" />\n            <MetricCard label="Breakdown" value={formatDuration(snapshot.summary.totalBreakdownMinutes)} detail="Recorded downtime" icon={Gauge} tone="text-orange-300" />`,
    `            <MetricCard label="Handover items" value={String(filteredSummary.total)} detail="In selected review period" icon={Wrench} />\n            <MetricCard label="Ongoing" value={String(filteredSummary.ongoing)} detail="Needs incoming action" icon={Timer} tone="text-blue-300" />\n            <MetricCard label="Completed" value={String(filteredSummary.completed)} detail="Returned or closed" icon={CheckCircle2} tone="text-emerald-300" />\n            <MetricCard label="Waiting parts" value={String(filteredSummary.waitingOnParts)} detail="Open material need" icon={Boxes} tone="text-amber-300" />\n            <MetricCard label="Contractor" value={String(filteredSummary.externalContractor)} detail="External support" icon={HardHat} tone="text-violet-300" />\n            <MetricCard label="Breakdown" value={formatDuration(filteredSummary.totalBreakdownMinutes)} detail="Recorded downtime" icon={Gauge} tone="text-orange-300" />`,
    "page filtered metric cards",
  );
  content = replaceOnce(
    content,
    `          <div className="flex items-end justify-between gap-4">\n            <div>\n              <h2 className="text-xl font-semibold text-slate-50">Previous shift activity</h2>\n              <p className="mt-1 text-sm text-slate-500">{filteredItems.length} of {snapshot.items.length} work orders</p>\n            </div>\n            <span className="hidden text-xs text-slate-600 sm:inline">SAP confirmations · work orders · goods movements · reservations</span>\n          </div>`,
    `          <div\n            data-vorta-shift-handover-review-period="true"\n            className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"\n          >\n            <label className="grid w-full gap-1 text-xs font-medium text-slate-500 sm:max-w-xs">\n              Review period\n              <select\n                value={reviewHours}\n                onChange={(event) => changeReviewPeriod(event.target.value)}\n                disabled={loading}\n                className="min-h-11 w-full rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-semibold text-slate-200 outline-none focus:border-blue-500/60 disabled:opacity-60"\n              >\n                {REVIEW_PERIOD_OPTIONS.map((option) => (\n                  <option key={option.value} value={option.value}>\n                    {option.label}\n                  </option>\n                ))}\n              </select>\n            </label>\n            {loading ? (\n              <span role="status" className="inline-flex items-center gap-2 text-xs text-blue-300">\n                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />\n                Loading {reviewPeriodLabel(reviewHours).toLowerCase()}…\n              </span>\n            ) : null}\n          </div>\n\n          <div className="flex items-end justify-between gap-4">\n            <div>\n              <h2 className="text-xl font-semibold text-slate-50">{reviewPeriodHeading(reviewHours)}</h2>\n              <p className="mt-1 text-sm text-slate-500">\n                {filteredItems.length} of {snapshot.items.length} work orders\n              </p>\n            </div>\n            <span className="hidden text-xs text-slate-600 sm:inline">SAP confirmations · work orders · goods movements · reservations</span>\n          </div>`,
    "page review selector and activity heading",
  );
  content = replaceOnce(
    content,
    `              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">\n                {filteredItems.map((item) => (\n                  <HandoverCard\n                    key={item.id}\n                    item={item}\n                    selected={selectedItem?.id === item.id}\n                    onOpen={() => openItem(item)}\n                  />\n                ))}\n              </div>`,
    `              <div className="space-y-5">\n                {activityGroups.map((group) => (\n                  <section\n                    key={group.key}\n                    data-vorta-shift-handover-date-group={group.key}\n                  >\n                    {group.label ? (\n                      <h3 className="mb-3 text-sm font-semibold text-slate-300">\n                        {group.label}\n                      </h3>\n                    ) : null}\n                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">\n                      {group.items.map((item) => (\n                        <HandoverCard\n                          key={item.id}\n                          item={item}\n                          selected={selectedItem?.id === item.id}\n                          onOpen={() => openItem(item)}\n                        />\n                      ))}\n                    </div>\n                  </section>\n                ))}\n              </div>`,
    "page date-grouped cards",
  );
  content = replaceOnce(
    content,
    `              <h2 className="mt-4 font-semibold text-slate-300">No handover items match these filters</h2>\n              <p className="mt-1 text-sm text-slate-600">Return to the site scope or remove a discipline, status or criticality filter.</p>`,
    `              <h2 className="mt-4 font-semibold text-slate-300">\n                {reviewPeriodEmptyState(reviewHours)}\n              </h2>\n              <p className="mt-1 text-sm text-slate-600">\n                Return to the site scope or remove a discipline, status or criticality filter.\n              </p>`,
    "page period-aware empty state",
  );
  content = content.replaceAll(
    `windowStart={snapshot.window.start}\n                     windowEnd={snapshot.window.end}`,
    `windowStart={selectedItem.handoverWindowStart}\n                     windowEnd={selectedItem.handoverWindowEnd}`,
  );
  content = content.replaceAll(
    `windowStart={snapshot.window.start}\n             windowEnd={snapshot.window.end}`,
    `windowStart={selectedItem.handoverWindowStart}\n             windowEnd={selectedItem.handoverWindowEnd}`,
  );
  if (content.includes("windowStart={snapshot.window.start}")) {
    throw new Error("VOR-025 page still writes workflow actions against the aggregate review window");
  }
  content = replaceOnce(
    content,
    `             Building the previous-shift handover from SAP evidence…`,
    `             Loading {reviewPeriodLabel(reviewHours).toLowerCase()} from SAP evidence…`,
    "page initial loading message",
  );
  write(path, content);
}

// Browser coverage: responsive control, every option, summary/list parity and no scroll reset.
{
  const path = "tests/browser/maintenance-manager-shift-handover.spec.ts";
  let content = read(path);
  content = content.replace(
    `  await expect(page.getByText(/SAP EVIDENCE/).first()).toBeVisible();\n`,
    "",
  );
  content = replaceOnce(
    content,
    `  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();\n`,
    `  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();\n  const reviewPeriod = page.getByLabel("Review period");\n  await expect(reviewPeriod).toBeVisible();\n  await expect(reviewPeriod).toHaveValue("12");\n  await expect(reviewPeriod.locator("option")).toHaveCount(5);\n`,
    "browser review control",
  );
  content = replaceOnce(
    content,
    `  expect(await cards.count()).toBeGreaterThan(0);\n\n  const viewportWidth`,
    `  expect(await cards.count()).toBeGreaterThan(0);\n\n  const scrollContainer = page.locator('[data-vorta-portal-scroll-container="true"]');\n  await scrollContainer.evaluate((element) => { element.scrollTop = 320; });\n  const scrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);\n  await reviewPeriod.selectOption("24");\n  await expect(page).toHaveURL(/review=24/);\n  await expect(reviewPeriod).toHaveValue("24");\n  await expect(page.getByRole("heading", { name: "Activity from the last 24 hours" })).toBeVisible();\n  await expect(page.locator('[data-vorta-shift-handover-date-group]').first()).toBeVisible();\n  await expect(cards.first()).toBeVisible({ timeout: 30_000 });\n  const scrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);\n  expect(scrollAfter).toBeGreaterThanOrEqual(Math.max(0, scrollBefore - 80));\n  const totalMetric = page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first();\n  await expect(totalMetric).toHaveText(String(await cards.count()));\n\n  const viewportWidth`,
    "browser period behavior",
  );
  content = replaceOnce(
    content,
    `  await expectNoPageOverflow(page);\n});\n\ntest("Shift Handover refreshes`,
    `  await expect(reviewPeriod).toHaveValue("24");\n  await expectNoPageOverflow(page);\n});\n\ntest("Shift Handover sends every approved review period to the evidence boundary", async ({\n  page,\n}, testInfo) => {\n  test.skip(testInfo.project.name !== "phone-360", "Exercise every period once; responsive presence is covered by all projects.");\n  test.setTimeout(150_000);\n  await signInMaintenanceManager(page);\n  await page.goto("/shift-handover");\n\n  const reviewPeriod = page.getByLabel("Review period");\n  await expect(reviewPeriod).toBeVisible();\n  for (const [value, heading] of [\n    ["24", "Activity from the last 24 hours"],\n    ["36", "Activity from the last 36 hours"],\n    ["48", "Activity from the last 48 hours"],\n    ["96", "Activity from the last 4 days"],\n    ["12", "Previous shift activity for Last 12 hours"],\n  ] as const) {\n    const evidenceRequest = page.waitForRequest((request) => {\n      if (!/\\/functions\\/v1\\/shift-handover-data(?:\\?.*)?$/.test(request.url())) return false;\n      if (request.method() !== "POST") return false;\n      try {\n        return Number(request.postDataJSON()?.reviewHours) === Number(value);\n      } catch {\n        return false;\n      }\n    });\n    await reviewPeriod.selectOption(value);\n    await evidenceRequest;\n    await expect(page.getByRole("heading", { name: heading })).toBeVisible();\n    await expect(reviewPeriod).toHaveValue(value);\n    await expectNoPageOverflow(page);\n  }\n});\n\ntest("Shift Handover refreshes`,
    "browser every review option",
  );
  write(path, content);
}

copyFileSync(
  resolve(root, "scripts/vor-025-edge-index.ts.txt"),
  resolve(root, "supabase/functions/shift-handover-data/index.ts"),
);
copyFileSync(
  resolve(root, "scripts/vor-025-contracts.mjs.txt"),
  resolve(root, "scripts/shift-handover-contracts.mjs"),
);

for (const path of [
  "scripts/vor-025-edge-index.ts.txt",
  "scripts/vor-025-contracts.mjs.txt",
  "scripts/vor-025-apply.mjs",
  ".github/workflows/vor-025-apply.yml",
]) {
  rmSync(resolve(root, path), { force: true });
}

console.log("VOR-025 source transformation applied and temporary files removed.");
