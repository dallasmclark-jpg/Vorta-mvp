from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "scripts/shift-handover-contracts.mjs"
content = path.read_text()
replacements = {
    '[edge.includes("new Set<number>([12, 24, 36, 48, 96])"), "The Edge Function must allow only the approved review periods."],':
        '[shiftWindows.includes("new Set<number>([12, 24, 36, 48, 96])"), "The completed-shift module must allow only the approved review periods."],',
    'nightSequence.shifts.map((shift) => shift.label).join(" · ") === "Night · Day · Night", "Three completed shifts must dynamically alternate during the night shift."':
        'nightSequence.shifts.map((shift) => shift.label).join(" · ") === "Day · Night · Day", "Three completed shifts must dynamically alternate when the current shift is Night."',
}
for old, new in replacements.items():
    if content.count(old) != 1:
        raise RuntimeError(f"Expected one contract match, found {content.count(old)}: {old}")
    content = content.replace(old, new, 1)
path.write_text(content)
print("VOR-030 contract corrections applied.")
