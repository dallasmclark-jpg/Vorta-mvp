from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "scripts/post-audit-p0-contracts.mjs",
    '''assert.match(equipmentRoute, /EquipmentLiveListEntry/);\nassert.match(equipmentRoute, /dataMode === "demo"/);\nassert.match(equipmentRoute, /<MobileEquipmentSection \/>/);''',
    '''assert.match(equipmentRoute, /EquipmentLiveListEntry/);\nassert.match(equipmentRoute, /if \\(isPhone\\)/);\nassert.match(\n  equipmentRoute,\n  /<MobileEquipmentSection[\\s\\S]*dataMode=\\{dataMode\\}[\\s\\S]*siteId=\\{siteContext\\?\\.siteId \\?\\? null\\}/,\n);\nassert.doesNotMatch(equipmentRoute, /dataMode === "demo"/);''',
)

replace_once(
    "src/screens/Equipment/EquipmentSpares.tsx",
    '''    if (!hasLoaded) {\n      setComponentsState("loading");\n      setQueueState("loading");\n    }\n\n''',
    '''''',
)
replace_once(
    "src/screens/Equipment/EquipmentSpares.tsx",
    '''  }, [hasLoaded, resolvedId]);''',
    '''  }, [resolvedId]);''',
)

print("Applied final VOR audit validation corrections.")
