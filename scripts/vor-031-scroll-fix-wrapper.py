from pathlib import Path
import runpy

script = Path(__file__).with_name("vor-031-scroll-fix.py")
content = script.read_text()
workflow_marker = '\nworkflow = ".github/workflows/shift-handover-quality.yml"\n'
if content.count(workflow_marker) != 1:
    raise RuntimeError("Could not isolate the workflow update section")
script.write_text(content.split(workflow_marker, 1)[0] + "\n")
runpy.run_path(str(script), run_name="__main__")
