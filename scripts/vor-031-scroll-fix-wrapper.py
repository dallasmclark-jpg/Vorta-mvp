from pathlib import Path
import runpy

script = Path(__file__).with_name("vor-031-scroll-fix.py")
content = script.read_text()

old_components = '''for marker in (
    '      - "src/components/VortaMultiSelect.tsx"\\n',
):
    replace_once(
        workflow,
        marker,
        '      - "src/components/VortaSelect.tsx"\\n' + marker,
    )
'''
new_components = '''marker = '      - "src/components/VortaMultiSelect.tsx"\\n'
workflow_path = ROOT / workflow
workflow_content = workflow_path.read_text()
if workflow_content.count(marker) != 2:
    raise RuntimeError("Expected the VortaMultiSelect workflow path twice")
workflow_path.write_text(
    workflow_content.replace(
        marker,
        '      - "src/components/VortaSelect.tsx"\\n' + marker,
    )
)
'''

old_tests = '''for marker in (
    '      - "tests/browser/maintenance-manager-shift-handover-team-filter.spec.ts"\\n',
):
    replace_once(
        workflow,
        marker,
        marker + '      - "tests/browser/maintenance-manager-shift-handover-select-scroll.spec.ts"\\n',
    )
'''
new_tests = '''marker = '      - "tests/browser/maintenance-manager-shift-handover-team-filter.spec.ts"\\n'
workflow_content = workflow_path.read_text()
if workflow_content.count(marker) != 2:
    raise RuntimeError("Expected the team-filter workflow path twice")
workflow_path.write_text(
    workflow_content.replace(
        marker,
        marker + '      - "tests/browser/maintenance-manager-shift-handover-select-scroll.spec.ts"\\n',
    )
)
'''

if content.count(old_components) != 1 or content.count(old_tests) != 1:
    raise RuntimeError("Could not locate the workflow replacement blocks")
script.write_text(content.replace(old_components, new_components).replace(old_tests, new_tests))
runpy.run_path(str(script), run_name="__main__")
