from __future__ import annotations

import base64
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise AssertionError(f"Missing {label}")
    return text.replace(old, new, 1)


route_path = Path("netlify/functions/ask-vorta/route-planning.mts")
route = route_path.read_text()
helper = base64.b64decode("ZnVuY3Rpb24gcGFyc2VFbmdsaXNoRGF0ZVJhbmdlKAogIHF1ZXN0aW9uOiBzdHJpbmcsCik6IHsgc3RhcnREYXRlOiBzdHJpbmc7IGVuZERhdGU6IHN0cmluZyB9IHwgbnVsbCB7CiAgY29uc3QgbW9udGhzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0gewogICAgamFuOiAxLAogICAgZmViOiAyLAogICAgbWFyOiAzLAogICAgYXByOiA0LAogICAgbWF5OiA1LAogICAganVuOiA2LAogICAganVsOiA3LAogICAgYXVnOiA4LAogICAgc2VwOiA5LAogICAgb2N0OiAxMCwKICAgIG5vdjogMTEsCiAgICBkZWM6IDEyLAogIH07CiAgY29uc3QgbW9udGhQYXR0ZXJuID0KICAgICJqYW4oPzp1YXJ5KT98ZmViKD86cnVhcnkpP3xtYXIoPzpjaCk/fGFwcig/OmlsKT98bWF5fGp1big/OmUpP3xqdWwoPzp5KT98YXVnKD86dXN0KT98c2VwKD86dCg/OmVtYmVyKT8pP3xvY3QoPzpvYmVyKT98bm92KD86ZW1iZXIpP3xkZWMoPzplbWJlcik/IjsKICBjb25zdCBub3JtYWxpemVkID0gcXVlc3Rpb24KICAgIC50b0xvd2VyQ2FzZSgpCiAgICAucmVwbGFjZSgvW+KAmSddL2csICInIikKICAgIC5yZXBsYWNlKC9bLOKAk+KAlF0vZywgIiAiKQogICAgLnJlcGxhY2UoL1xzKy9nLCAiICIpCiAgICAudHJpbSgpOwogIGNvbnN0IHRvSXNvRGF0ZSA9ICgKICAgIGRheVRleHQ6IHN0cmluZywKICAgIG1vbnRoVGV4dDogc3RyaW5nLAogICAgeWVhclRleHQ6IHN0cmluZywKICApOiBzdHJpbmcgfCBudWxsID0+IHsKICAgIGNvbnN0IGRheSA9IE51bWJlcihkYXlUZXh0KTsKICAgIGNvbnN0IG1vbnRoID0gbW9udGhzW21vbnRoVGV4dC5zbGljZSgwLCAzKV07CiAgICBjb25zdCB5ZWFyID0gTnVtYmVyKHllYXJUZXh0KTsKICAgIGlmICghbW9udGggfHwgIU51bWJlci5pc0ludGVnZXIoZGF5KSB8fCAhTnVtYmVyLmlzSW50ZWdlcih5ZWFyKSkgcmV0dXJuIG51bGw7CiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoRGF0ZS5VVEMoeWVhciwgbW9udGggLSAxLCBkYXkpKTsKICAgIGlmICgKICAgICAgZGF0ZS5nZXRVVENGdWxsWWVhcigpICE9PSB5ZWFyIHx8CiAgICAgIGRhdGUuZ2V0VVRDTW9udGgoKSAhPT0gbW9udGggLSAxIHx8CiAgICAgIGRhdGUuZ2V0VVRDRGF0ZSgpICE9PSBkYXkKICAgICkgewogICAgICByZXR1cm4gbnVsbDsKICAgIH0KICAgIHJldHVybiBkYXRlLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApOwogIH07CgogIGNvbnN0IHJhbmdlTWF0Y2ggPSBub3JtYWxpemVkLm1hdGNoKAogICAgbmV3IFJlZ0V4cCgKICAgICAgYFxcYig/OmZyb21cXHMrfGJldHdlZW5cXHMrKShcXGR7MSwyfSkoPzpzdHxuZHxyZHx0aCk/XFxzKygke21vbnRoUGF0dGVybn0pKD86XFxzKyhcXGR7NH0pKT9cXHMrKD86dG98YW5kKVxccysoXFxkezEsMn0pKD86c3R8bmR8cmR8dGgpP1xccysoJHttb250aFBhdHRlcm59KSg/OlxccysoXFxkezR9KSk/XFxiYCwKICAgICAgImkiLAogICAgKSwKICApOwogIGlmIChyYW5nZU1hdGNoKSB7CiAgICBjb25zdCBzaGFyZWRZZWFyID0gcmFuZ2VNYXRjaFs2XSB8fCByYW5nZU1hdGNoWzNdOwogICAgaWYgKCFzaGFyZWRZZWFyKSByZXR1cm4gbnVsbDsKICAgIGNvbnN0IHN0YXJ0RGF0ZSA9IHRvSXNvRGF0ZSgKICAgICAgcmFuZ2VNYXRjaFsxXSwKICAgICAgcmFuZ2VNYXRjaFsyXSwKICAgICAgcmFuZ2VNYXRjaFszXSB8fCBzaGFyZWRZZWFyLAogICAgKTsKICAgIGNvbnN0IGVuZERhdGUgPSB0b0lzb0RhdGUoCiAgICAgIHJhbmdlTWF0Y2hbNF0sCiAgICAgIHJhbmdlTWF0Y2hbNV0sCiAgICAgIHJhbmdlTWF0Y2hbNl0gfHwgc2hhcmVkWWVhciwKICAgICk7CiAgICBpZiAoIXN0YXJ0RGF0ZSB8fCAhZW5kRGF0ZSB8fCBzdGFydERhdGUgPiBlbmREYXRlKSByZXR1cm4gbnVsbDsKICAgIHJldHVybiB7IHN0YXJ0RGF0ZSwgZW5kRGF0ZSB9OwogIH0KCiAgY29uc3Qgc2luZ2xlTWF0Y2ggPSBub3JtYWxpemVkLm1hdGNoKAogICAgbmV3IFJlZ0V4cCgKICAgICAgYFxcYig/Om9uXFxzK3xmb3JcXHMrKT8oXFxkezEsMn0pKD86c3R8bmR8cmR8dGgpP1xccysoJHttb250aFBhdHRlcm59KVxccysoXFxkezR9KVxcYmAsCiAgICAgICJpIiwKICAgICksCiAgKTsKICBpZiAoIXNpbmdsZU1hdGNoKSByZXR1cm4gbnVsbDsKICBjb25zdCBkYXRlID0gdG9Jc29EYXRlKHNpbmdsZU1hdGNoWzFdLCBzaW5nbGVNYXRjaFsyXSwgc2luZ2xlTWF0Y2hbM10pOwogIHJldHVybiBkYXRlID8geyBzdGFydERhdGU6IGRhdGUsIGVuZERhdGU6IGRhdGUgfSA6IG51bGw7Cn0KCg==").decode()

if "function parseEnglishDateRange(" not in route:
    route = replace_once(
        route,
        "export function deterministicQuestionPlan(\n",
        helper + "export function deterministicQuestionPlan(\n",
        "date parser insertion point",
    )

if "const explicitCoverRange = parseEnglishDateRange(" not in route:
    marker = '  const contextText = [...request.history.map((item) => item.content), request.question].join(" ");\n'
    date_context = """  const explicitCoverRange = parseEnglishDateRange(request.question);
  const absoluteWorkforceQuestion =
    explicitCoverRange !== null &&
    /\\b(?:who(?:'s| is)? off|holiday|absence|leave|training|available|availability|cover|coverage|rest conflict|fatigue|rota|engineers?|team|shift)\\b/.test(
      question,
    );

"""
    route = replace_once(
        route,
        marker,
        date_context + marker,
        "absolute workforce context insertion point",
    )

route = replace_once(
    route,
    "  if (equipmentQuery) {",
    "  if (equipmentQuery && !absoluteWorkforceQuestion) {",
    "equipment precedence",
)

range_start = route.find("  const requestedCoverRange = ")
range_end = route.find(";\n  const planAndCover", range_start)
if range_start < 0 or range_end < 0:
    raise AssertionError("Missing requested cover range block")
range_end += 1
new_range = """  const requestedCoverRange =
    explicitCoverRange ??
    (nextWeek
      ? nextWeekRange()
      : thisWeek
        ? thisWeekRange()
        : { startDate: coverDate ?? today, endDate: coverDate ?? today });"""
route = route[:range_start] + new_range + route[range_end:]

route = replace_once(
    route,
    "if (planAndCover && (coverDate || nextWeek || thisWeek))",
    "if (planAndCover && (explicitCoverRange || coverDate || nextWeek || thisWeek))",
    "maintenance plan date scope",
)
route = replace_once(
    route,
    "    (coverDate !== null || nextWeek || thisWeek) &&",
    "    (explicitCoverRange !== null || coverDate !== null || nextWeek || thisWeek) &&",
    "dated workforce detection",
)

contractor_index = route.find('"contractor_support"')
if contractor_index < 0:
    raise AssertionError("Missing contractor route")
contractor_focus = '"Report only recorded contractor skills and availability, with any confirmation caveat.",'
contractor_focus_index = route.find(contractor_focus, contractor_index)
if contractor_focus_index < 0:
    raise AssertionError("Missing contractor answer focus")
route = (
    route[:contractor_focus_index]
    + '"Report only recorded contractor skills and availability, with the first confirmation action and any caveat.",'
    + route[contractor_focus_index + len(contractor_focus):]
)
contractor_options = route.find("{ summaryItemLimit: 4 },", contractor_focus_index)
if contractor_options < 0:
    raise AssertionError("Missing contractor options")
route = (
    route[:contractor_options]
    + "{ summaryItemLimit: 4, forceActionPlan: true },"
    + route[contractor_options + len("{ summaryItemLimit: 4 },"):]
)

backlog_index = route.find('"work_backlog"')
if backlog_index < 0:
    raise AssertionError("Missing backlog route")
backlog_focus = '"Prioritise the current work backlog using exact orders, assets, dates and readiness evidence.",'
backlog_focus_index = route.find(backlog_focus, backlog_index)
if backlog_focus_index < 0:
    raise AssertionError("Missing backlog answer focus")
route = (
    route[:backlog_focus_index]
    + '"Prioritise the current work backlog using exact orders, assets, dates and readiness evidence, then state the first executable action.",'
    + route[backlog_focus_index + len(backlog_focus):]
)
backlog_options = route.find("{ summaryItemLimit: 4 },", backlog_focus_index)
if backlog_options < 0:
    raise AssertionError("Missing backlog options")
route = (
    route[:backlog_options]
    + "{ summaryItemLimit: 4, forceActionPlan: true },"
    + route[backlog_options + len("{ summaryItemLimit: 4 },"):]
)
route_path.write_text(route)

Path(".github/workflows/maintenance-manager-production.yml").write_bytes(
    base64.b64decode("bmFtZTogTWFpbnRlbmFuY2UgTWFuYWdlciBwcm9kdWN0aW9uIHZlcmlmaWNhdGlvbgoKb246CiAgd29ya2Zsb3dfcnVuOgogICAgd29ya2Zsb3dzOgogICAgICAtIE1haW50ZW5hbmNlIE1hbmFnZXIgcXVhbGl0eSBnYXRlCiAgICB0eXBlczoKICAgICAgLSBjb21wbGV0ZWQKCnBlcm1pc3Npb25zOgogIGNvbnRlbnRzOiByZWFkCgpjb25jdXJyZW5jeToKICBncm91cDogbWFpbnRlbmFuY2UtbWFuYWdlci1wcm9kdWN0aW9uLSR7eyBnaXRodWIuZXZlbnQud29ya2Zsb3dfcnVuLmhlYWRfc2hhIH19CiAgY2FuY2VsLWluLXByb2dyZXNzOiB0cnVlCgpqb2JzOgogIHByb2R1Y3Rpb246CiAgICBpZjogPi0KICAgICAgZ2l0aHViLmV2ZW50LndvcmtmbG93X3J1bi5jb25jbHVzaW9uID09ICdzdWNjZXNzJyAmJgogICAgICBnaXRodWIuZXZlbnQud29ya2Zsb3dfcnVuLmhlYWRfYnJhbmNoID09ICdtYWluJwogICAgbmFtZTogVmVyaWZ5IGV4YWN0IHByb2R1Y3Rpb24gY29tbWl0CiAgICBydW5zLW9uOiB1YnVudHUtbGF0ZXN0CiAgICB0aW1lb3V0LW1pbnV0ZXM6IDQwCiAgICBlbnY6CiAgICAgIEVYUEVDVEVEX0NPTU1JVDogJHt7IGdpdGh1Yi5ldmVudC53b3JrZmxvd19ydW4uaGVhZF9zaGEgfX0KICAgICAgVk9SVEFfUFJPRFVDVElPTl9VUkw6IGh0dHBzOi8vdm9ydGEtYXBwLm5ldGxpZnkuYXBwCiAgICAgIFZPUlRBX0UyRV9CQVNFX1VSTDogaHR0cHM6Ly92b3J0YS1hcHAubmV0bGlmeS5hcHAKICAgICAgVk9SVEFfRTJFX0VNQUlMOiBkZW1vQHZvcnRhLm5ldHdvcmsKICAgICAgVk9SVEFfRTJFX1BBU1NXT1JEOiAke3sgc2VjcmV0cy5WT1JUQV9FMkVfUEFTU1dPUkQgfX0KICAgICAgVk9SVEFfRTJFX1NJVEVfSUQ6IDExMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMQogICAgICBWT1JUQV9FMkVfREVOSUVEX1NJVEVfSUQ6IDExMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMgogICAgICBWSVRFX1NVUEFCQVNFX1VSTDogaHR0cHM6Ly9uZGhxeGV0dmthZXlpd3ZudmpqeS5zdXBhYmFzZS5jbwogICAgICBWSVRFX1NVUEFCQVNFX0FOT05fS0VZOiBzYl9wdWJsaXNoYWJsZV9KQ3hPVUIzM0lucVBoVEpXd0RWUmZRX1lpM1A2TkJxCgogICAgc3RlcHM6CiAgICAgIC0gbmFtZTogQ2hlY2sgb3V0IGRlcGxveWVkIGNvbW1pdAogICAgICAgIHVzZXM6IGFjdGlvbnMvY2hlY2tvdXRAdjQKICAgICAgICB3aXRoOgogICAgICAgICAgcmVmOiAke3sgZ2l0aHViLmV2ZW50LndvcmtmbG93X3J1bi5oZWFkX3NoYSB9fQogICAgICAgICAgc2hvdy1wcm9ncmVzczogZmFsc2UKCiAgICAgIC0gbmFtZTogVXNlIE5vZGUuanMKICAgICAgICB1c2VzOiBhY3Rpb25zL3NldHVwLW5vZGVAdjQKICAgICAgICB3aXRoOgogICAgICAgICAgbm9kZS12ZXJzaW9uOiAyMgogICAgICAgICAgY2FjaGU6IG5wbQoKICAgICAgLSBuYW1lOiBJbnN0YWxsIGFwcGxpY2F0aW9uIGRlcGVuZGVuY2llcwogICAgICAgIHJ1bjogbnBtIGNpIC0tc2lsZW50CgogICAgICAtIG5hbWU6IFZlcmlmeSBOZXRsaWZ5IHNlcnZlcyB0aGUgZXhhY3QgdGVzdGVkIGNvbW1pdAogICAgICAgIHJ1bjogbm9kZSBzY3JpcHRzL3ZlcmlmeS1wcm9kdWN0aW9uLWNvbW1pdC5tanMKCiAgICAgIC0gbmFtZTogVmVyaWZ5IGF1dGhlbnRpY2F0ZWQgYnJvd3Nlci10ZXN0IHNlY3JldAogICAgICAgIHNoZWxsOiBiYXNoCiAgICAgICAgcnVuOiB8CiAgICAgICAgICB0ZXN0IC1uICIkVk9SVEFfRTJFX1BBU1NXT1JEIiB8fCB7CiAgICAgICAgICAgIGVjaG8gIlZPUlRBX0UyRV9QQVNTV09SRCBpcyBub3QgY29uZmlndXJlZCBmb3IgcHJvZHVjdGlvbiB2ZXJpZmljYXRpb24uIiA+JjIKICAgICAgICAgICAgZXhpdCAxCiAgICAgICAgICB9CgogICAgICAtIG5hbWU6IFJ1biBmaXJzdCAxMiBBc2sgVm9ydGEgcHJvZHVjdGlvbiBkZWNpc2lvbnMKICAgICAgICBpZDogcHJvZHVjdGlvbl93aW5kb3dfb25lCiAgICAgICAgY29udGludWUtb24tZXJyb3I6IHRydWUKICAgICAgICBzaGVsbDogYmFzaAogICAgICAgIGVudjoKICAgICAgICAgIFZPUlRBX0VWQUxfQkFTRV9VUkw6IGh0dHBzOi8vdm9ydGEtYXBwLm5ldGxpZnkuYXBwCiAgICAgICAgICBWT1JUQV9FVkFMX1NJVEVfSUQ6ICR7eyBlbnYuVk9SVEFfRTJFX1NJVEVfSUQgfX0KICAgICAgICAgIFZPUlRBX0VWQUxfT0ZGU0VUOiAwCiAgICAgICAgICBWT1JUQV9FVkFMX0xJTUlUOiAxMgogICAgICAgIHJ1bjogfAogICAgICAgICAgc2V0IC1vIHBpcGVmYWlsCiAgICAgICAgICBucG0gcnVuIGV2YWw6YXNrLXZvcnRhOmxpdmUgMj4mMSB8IHRlZSBhc2stdm9ydGEtcHJvZHVjdGlvbi13aW5kb3ctMS5sb2cKCiAgICAgIC0gbmFtZTogUmVzZXQgcHJvZHVjdGlvbiBldmFsdWF0aW9uIHJhdGUgd2luZG93CiAgICAgICAgaWY6IGFsd2F5cygpCiAgICAgICAgcnVuOiBzbGVlcCAzMTAKCiAgICAgIC0gbmFtZTogUnVuIGZpbmFsIEFzayBWb3J0YSBwcm9kdWN0aW9uIGRlY2lzaW9uCiAgICAgICAgaWQ6IHByb2R1Y3Rpb25fd2luZG93X3R3bwogICAgICAgIGlmOiBhbHdheXMoKQogICAgICAgIGNvbnRpbnVlLW9uLWVycm9yOiB0cnVlCiAgICAgICAgc2hlbGw6IGJhc2gKICAgICAgICBlbnY6CiAgICAgICAgICBWT1JUQV9FVkFMX0JBU0VfVVJMOiBodHRwczovL3ZvcnRhLWFwcC5uZXRsaWZ5LmFwcAogICAgICAgICAgVk9SVEFfRVZBTF9TSVRFX0lEOiAke3sgZW52LlZPUlRBX0UyRV9TSVRFX0lEIH19CiAgICAgICAgICBWT1JUQV9FVkFMX09GRlNFVDogMTIKICAgICAgICAgIFZPUlRBX0VWQUxfTElNSVQ6IDEKICAgICAgICBydW46IHwKICAgICAgICAgIHNldCAtbyBwaXBlZmFpbAogICAgICAgICAgbnBtIHJ1biBldmFsOmFzay12b3J0YTpsaXZlIDI+JjEgfCB0ZWUgYXNrLXZvcnRhLXByb2R1Y3Rpb24td2luZG93LTIubG9nCgogICAgICAtIG5hbWU6IFByZXNlcnZlIEFzayBWb3J0YSBwcm9kdWN0aW9uIGV2YWx1YXRpb24gZXZpZGVuY2UKICAgICAgICBpZjogYWx3YXlzKCkKICAgICAgICB1c2VzOiBhY3Rpb25zL3VwbG9hZC1hcnRpZmFjdEB2NAogICAgICAgIHdpdGg6CiAgICAgICAgICBuYW1lOiBhc2stdm9ydGEtcHJvZHVjdGlvbi1ldmlkZW5jZS0ke3sgZ2l0aHViLmV2ZW50LndvcmtmbG93X3J1bi5oZWFkX3NoYSB9fQogICAgICAgICAgcGF0aDogfAogICAgICAgICAgICBhc2stdm9ydGEtcHJvZHVjdGlvbi13aW5kb3ctMS5sb2cKICAgICAgICAgICAgYXNrLXZvcnRhLXByb2R1Y3Rpb24td2luZG93LTIubG9nCiAgICAgICAgICBpZi1uby1maWxlcy1mb3VuZDogZXJyb3IKICAgICAgICAgIHJldGVudGlvbi1kYXlzOiAxNAoKICAgICAgLSBuYW1lOiBFbmZvcmNlIEFzayBWb3J0YSBwcm9kdWN0aW9uIGV2YWx1YXRpb25zCiAgICAgICAgaWY6IGFsd2F5cygpCiAgICAgICAgc2hlbGw6IGJhc2gKICAgICAgICBydW46IHwKICAgICAgICAgIHRlc3QgIiR7eyBzdGVwcy5wcm9kdWN0aW9uX3dpbmRvd19vbmUub3V0Y29tZSB9fSIgPSAic3VjY2VzcyIgfHwgewogICAgICAgICAgICBlY2hvICJUaGUgZmlyc3QgMTIgQXNrIFZvcnRhIHByb2R1Y3Rpb24gZGVjaXNpb25zIGZhaWxlZC4iID4mMgogICAgICAgICAgICBleGl0IDEKICAgICAgICAgIH0KICAgICAgICAgIHRlc3QgIiR7eyBzdGVwcy5wcm9kdWN0aW9uX3dpbmRvd190d28ub3V0Y29tZSB9fSIgPSAic3VjY2VzcyIgfHwgewogICAgICAgICAgICBlY2hvICJUaGUgZmluYWwgQXNrIFZvcnRhIHByb2R1Y3Rpb24gZGVjaXNpb24gZmFpbGVkLiIgPiYyCiAgICAgICAgICAgIGV4aXQgMQogICAgICAgICAgfQoKICAgICAgLSBuYW1lOiBJbnN0YWxsIGJyb3dzZXItdGVzdCBydW5uZXIgd2l0aG91dCBjaGFuZ2luZyB0aGUgbG9ja2ZpbGUKICAgICAgICBydW46IG5wbSBpbnN0YWxsIC0tbm8tc2F2ZSAtLXBhY2thZ2UtbG9jaz1mYWxzZSAtLXNpbGVudCBAcGxheXdyaWdodC90ZXN0QDEuNTUuMAoKICAgICAgLSBuYW1lOiBJbnN0YWxsIENocm9taXVtCiAgICAgICAgcnVuOiBucHggcGxheXdyaWdodCBpbnN0YWxsIC0td2l0aC1kZXBzIGNocm9taXVtCgogICAgICAtIG5hbWU6IFJ1biBhdXRoZW50aWNhdGVkIHByb2R1Y3Rpb24gcmVncmVzc2lvbgogICAgICAgIHJ1bjogbnBtIHJ1biB0ZXN0OmJyb3dzZXIK")
)

contract_suite_path = Path("scripts/run-contract-suite.mjs")
contract_suite = contract_suite_path.read_text()
contract_line = '  ["VOR-055 Ask Vorta production verification", "scripts/vor-055-production-verification-contracts.mjs"],\n'
if contract_line not in contract_suite:
    marker = '  ["VOR-053 canonical Ask Vorta build", "scripts/vor-053-canonical-build-contracts.mjs"],\n'
    contract_suite = replace_once(
        contract_suite,
        marker,
        marker + contract_line,
        "permanent contract registration",
    )
    contract_suite_path.write_text(contract_suite)

central_path = Path(".github/workflows/vor-049-validation.yml")
central = central_path.read_text()
trigger_block = """      - "scripts/vor-054*"
      - "scripts/vor-055*"
      - "tests/evals/ask-vorta-live-golden.json"
      - ".github/workflows/maintenance-manager-production.yml" """
trigger_block = trigger_block.rstrip()
if '      - "scripts/vor-055*"' not in central:
    if central.count('      - "scripts/vor-054*"') != 2:
        raise AssertionError("Unexpected VOR-054 trigger count")
    central = central.replace('      - "scripts/vor-054*"', trigger_block)
    central_path.write_text(central)

for temporary_path in (
    Path(".github/workflows/vor-055-apply-fix.yml"),
    Path(".github/workflows/vor-055-apply-fix-v2.yml"),
    Path("scripts/vor-055-apply-fix.py"),
):
    if temporary_path.exists():
        temporary_path.unlink()
