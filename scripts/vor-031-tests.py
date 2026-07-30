from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement, found {count}: {old[:100]!r}")
    target.write_text(content.replace(old, new, 1))


path = "scripts/shift-handover-contracts.mjs"
replace_once(
    path,
    'const vortaSelect = read("src/components/VortaSelect.tsx");\n',
    'const vortaSelect = read("src/components/VortaSelect.tsx");\n'
    'const vortaMultiSelect = read("src/components/VortaMultiSelect.tsx");\n',
)
replace_once(
    path,
    'const rotaAssignments = read("supabase/functions/shift-handover-data/rotaAssignments.ts");\n',
    'const rotaAssignments = read("supabase/functions/shift-handover-data/rotaAssignments.ts");\n'
    'const teamAttribution = read("supabase/functions/shift-handover-data/teamAttribution.ts");\n',
)
replace_once(
    path,
    '''  [!page.includes("<select") && (page.match(/<VortaSelect/g) ?? []).length === 4, "Shift Handover must not invoke native browser select dialogs."],''',
    '''  [!page.includes("<select") && (page.match(/<VortaSelect/g) ?? []).length === 4 && (page.match(/<VortaMultiSelect/g) ?? []).length === 1, "Shift Handover must use the shared styled selectors and one maintenance-team multi-select."],''',
)
replace_once(
    path,
    '''  [page.includes("activeAdvancedFilterCount") && page.includes("Filters{activeAdvancedFilterCount"), "Mobile advanced filters must expose the active Criticality and Status count."],''',
    '''  [page.includes("activeAdvancedFilterCount") && page.includes("maintenanceTeams.length > 0") && page.includes("Filters{activeAdvancedFilterCount"), "Mobile advanced filters must count Maintenance team, Criticality and Status."],''',
)
replace_once(
    path,
    '''  [page.includes('return "Previous shift: Previous shift activity"') && page.includes("Activity from the previous ${count} shifts"), "Activity headings must use completed-shift terminology."],''',
    '''  [page.includes('return "Previous shift activity"') && page.includes("Activity from the previous ${count} shifts"), "Activity headings must be concise and use completed-shift terminology."],''',
)
replace_once(
    path,
    '''  [service.includes("ShiftHandoverReviewHours") && service.includes("reviewHours"), "The service contract must carry the selected review period."],''',
    '''  [service.includes("ShiftHandoverReviewHours") && service.includes("reviewHours"), "The service contract must carry the selected review period."],
  [service.includes("ShiftHandoverMaintenanceTeam") && service.includes("hasUnassignedActivity"), "The service contract must carry confirmation-level and work-order team attribution."],
  [vortaMultiSelect.includes('aria-multiselectable="true"') && vortaMultiSelect.includes("visualViewport") && vortaMultiSelect.includes('data-vorta-multi-select-trigger="true"'), "Maintenance team selection must be accessible, viewport-aware and mobile safe."],
  [page.includes('label="Maintenance team"') && page.includes("All maintenance teams") && shiftPresentation.includes("Calibration Team"), "All six approved maintenance teams must be available."],
  [page.includes("MaintenanceTeamBadges") && page.includes("confirmation.maintenanceTeams"), "Cards and confirmation history must expose team badges."],
  [edge.includes("attachMaintenanceTeamAttribution") && edge.includes("personnel_number") && edge.includes("engineer_source_identities") && edge.includes("maintenance_shift_team_members"), "Historical team attribution must use confirmation identity and effective-dated membership evidence."],
  [teamAttribution.includes("validOnDate") && teamAttribution.includes("historical_membership") && teamAttribution.includes("specialist_scope"), "Team attribution must support historical membership and the established calibration specialist scope."],''',
)
replace_once(
    path,
    '''  [shiftPresentation.includes("SHIFT_TEAM_PRESENTATION") && shiftPresentation.includes("YELLOW") && shiftPresentation.includes("RED") && shiftPresentation.includes("GREEN") && shiftPresentation.includes("BLUE"), "Shift Handover must use the established Shift Calendar team palette."],''',
    '''  [shiftPresentation.includes("VORTA_MAINTENANCE_TEAM_PRESENTATION") && shiftPresentation.includes("CALIBRATION") && shiftPresentation.includes("bg-violet-400") && shiftPresentation.includes("YELLOW") && shiftPresentation.includes("RED") && shiftPresentation.includes("GREEN") && shiftPresentation.includes("BLUE"), "Shift Handover must use the canonical Vorta maintenance-team palette, including violet Calibration."],''',
)

path = "tests/browser/maintenance-manager-shift-handover.spec.ts"
replace_once(
    path,
    '''  const criticalitySelect = page.getByRole("button", { name: "Criticality", exact: true });''',
    '''  const maintenanceTeamSelect = page.getByRole("button", { name: "Maintenance team", exact: true });
  const criticalitySelect = page.getByRole("button", { name: "Criticality", exact: true });''',
)
replace_once(
    path,
    '''    await expect(criticalitySelect).toBeHidden();''',
    '''    await expect(maintenanceTeamSelect).toBeHidden();
    await expect(criticalitySelect).toBeHidden();''',
)
replace_once(
    path,
    '''    await expect(criticalitySelect).toBeVisible();''',
    '''    await expect(maintenanceTeamSelect).toBeVisible();
    await expect(criticalitySelect).toBeVisible();''',
)
for _ in range(2):
    replace_once(
        path,
        '''  await expect(page.getByRole("heading", { name: "Previous 2 shifts: Activity from the previous 2 shifts" })).toBeVisible();''',
        '''  await expect(page.getByRole("heading", { name: "Activity from the previous 2 shifts", exact: true })).toBeVisible();''',
    )
replace_once(
    path,
    '''  await expect(page.getByRole("heading", { name: "Previous shift: Previous shift activity", exact: true })).toBeVisible();''',
    '''  await expect(page.getByRole("heading", { name: "Previous shift activity", exact: true })).toBeVisible();''',
)
replace_once(
    path,
    '''  await expect(cards.first()).toBeVisible();

  await chooseVortaSelect(page, "Review period", "Previous 2 shifts · 24 hours");''',
    '''  await expect(cards.first()).toBeVisible();
  await expect(cards.first().locator('[data-vorta-shift-handover-team-badges="true"]')).toBeVisible();

  await chooseVortaSelect(page, "Review period", "Previous 2 shifts · 24 hours");''',
)

print("VOR-031 test patch applied")
