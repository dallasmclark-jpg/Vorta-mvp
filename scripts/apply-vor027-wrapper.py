from pathlib import Path
import re

workflow = Path('.github/workflows/vor-027-apply.yml').read_text()
opening = "          python <<'PY'\n"
closing = "\n          PY\n\n          git diff --check"
start = workflow.index(opening) + len(opening)
end = workflow.index(closing, start)
script = workflow[start:end]
script = "\n".join(
    line[10:] if line.startswith("          ") else line
    for line in script.splitlines()
)
marker_pattern = re.compile(
    r"scope_start = page\.index\(.*?\)\nsearch_marker = .*?\nsearch_start = page\.index\(search_marker, scope_start\)",
)
marker_replacement = '''scope_anchor = page.find('<section data-vorta-group-frame="true"', page.find('Waiting parts'))
if scope_anchor < 0:
    raise SystemExit('The Handover scope section could not be located after summary replacement.')
scope_start = page.rfind("\\n", 0, scope_anchor) + 1
search_anchor = page.find('<div className="mt-4 grid gap-3 border-t border-gray-800 pt-4', scope_start)
if search_anchor < 0:
    raise SystemExit('The Handover search/filter block could not be located.')
search_start = page.rfind("\\n", 0, search_anchor) + 1'''
script, marker_count = marker_pattern.subn(marker_replacement, script, count=1)
if marker_count != 1:
    raise SystemExit(f'Expected one scope marker block, found {marker_count}.')
exec(compile(script, 'vor-027-apply.py', 'exec'))
for temporary in [
    'docs/vor-027-implementation-note.md',
    'docs/.keep-vor027',
    'docs/.vor027-trigger',
    'docs/.vor027-final-trigger',
    'docs/.vor027-trigger-5',
    'scripts/apply-vor027-wrapper.py',
]:
    Path(temporary).unlink(missing_ok=True)
