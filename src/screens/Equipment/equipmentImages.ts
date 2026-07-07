export type EquipmentImageVariant =
  | "palletiser"
  | "vial-filler"
  | "hvac"
  | "boiler"
  | "compressor"
  | "conveyor"
  | "plc"
  | "forklift"
  | "motor"
  | "lighting"
  | "case-packer"
  | "generic";

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function iconFor(variant: EquipmentImageVariant): string {
  switch (variant) {
    case "vial-filler":
      return `
        <rect x="40" y="92" width="320" height="16" rx="3" fill="#0d2040" stroke="#1e3a5f"/>
        <rect x="40" y="160" width="320" height="18" rx="3" fill="#0d2040" stroke="#1e3a5f"/>
        <rect x="62" y="66" width="18" height="94" rx="3" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="67" y="56" width="8" height="12" rx="1" fill="#213d6b" stroke="#2d5a8e"/>
        <rect x="112" y="66" width="18" height="94" rx="3" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="117" y="56" width="8" height="12" rx="1" fill="#213d6b" stroke="#2d5a8e"/>
        <rect x="162" y="66" width="18" height="94" rx="3" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="167" y="56" width="8" height="12" rx="1" fill="#213d6b" stroke="#2d5a8e"/>
        <rect x="212" y="66" width="18" height="94" rx="3" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="217" y="56" width="8" height="12" rx="1" fill="#213d6b" stroke="#2d5a8e"/>
        <rect x="262" y="66" width="18" height="94" rx="3" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="267" y="56" width="8" height="12" rx="1" fill="#213d6b" stroke="#2d5a8e"/>
        <rect x="312" y="66" width="18" height="94" rx="3" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="317" y="56" width="8" height="12" rx="1" fill="#213d6b" stroke="#2d5a8e"/>
        <rect x="135" y="38" width="130" height="46" rx="5" fill="#101e3a" stroke="#2d5a8e"/>
        <rect x="150" y="50" width="30" height="6" rx="1" fill="#1e3a5f"/>
        <rect x="188" y="50" width="30" height="6" rx="1" fill="#1e3a5f"/>
        <rect x="226" y="50" width="20" height="6" rx="1" fill="#1e3a5f"/>`;

    case "palletiser":
      return `
        <rect x="54" y="170" width="120" height="10" rx="2" fill="#0d2040" stroke="#1a3a6e"/>
        <rect x="75" y="152" width="72" height="18" rx="2" fill="#1e3a5f" stroke="#2d5a8e"/>
        <rect x="92" y="134" width="38" height="18" rx="2" fill="#1e3a5f" stroke="#2d5a8e"/>
        <rect x="168" y="100" width="16" height="82" rx="3" fill="#213d6b" stroke="#2d5a8e"/>
        <line x1="176" y1="104" x2="245" y2="62" stroke="#2d5a8e" stroke-width="3" stroke-linecap="round"/>
        <circle cx="245" cy="62" r="8" fill="#162f55" stroke="#3a72b0"/>
        <line x1="245" y1="70" x2="245" y2="140" stroke="#2d5a8e" stroke-width="1.5" stroke-dasharray="4 3"/>
        <rect x="225" y="140" width="40" height="28" rx="3" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="285" y="156" width="60" height="26" rx="3" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="295" y="144" width="40" height="14" rx="2" fill="#1a3660" stroke="#2d5a8e"/>
        <line x1="30" y1="180" x2="370" y2="180" stroke="#1e3a5f" stroke-width="2"/>`;

    case "hvac":
      return `
        <rect x="62" y="88" width="276" height="86" rx="8" fill="#101e3a" stroke="#2d5a8e"/>
        <circle cx="120" cy="131" r="28" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="120" cy="131" r="10" fill="#1e3a5f"/>
        <circle cx="280" cy="131" r="28" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="280" cy="131" r="10" fill="#1e3a5f"/>
        <rect x="170" y="104" width="60" height="12" rx="2" fill="#1e3a5f"/>
        <rect x="170" y="126" width="60" height="12" rx="2" fill="#1e3a5f"/>
        <rect x="170" y="148" width="60" height="12" rx="2" fill="#1e3a5f"/>`;

    case "boiler":
      return `
        <rect x="112" y="64" width="176" height="112" rx="16" fill="#101e3a" stroke="#2d5a8e"/>
        <circle cx="154" cy="118" r="22" fill="#0d2040" stroke="#3a72b0"/>
        <rect x="205" y="84" width="48" height="12" rx="2" fill="#1e3a5f"/>
        <rect x="205" y="110" width="48" height="12" rx="2" fill="#1e3a5f"/>
        <rect x="205" y="136" width="48" height="12" rx="2" fill="#1e3a5f"/>
        <line x1="95" y1="178" x2="305" y2="178" stroke="#1e3a5f" stroke-width="3"/>`;

    case "compressor":
      return `
        <rect x="76" y="112" width="160" height="64" rx="10" fill="#101e3a" stroke="#2d5a8e"/>
        <circle cx="122" cy="178" r="14" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="202" cy="178" r="14" fill="#0d2040" stroke="#3a72b0"/>
        <rect x="245" y="88" width="72" height="88" rx="8" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="258" y="104" width="46" height="10" rx="2" fill="#1e3a5f"/>
        <rect x="258" y="126" width="46" height="10" rx="2" fill="#1e3a5f"/>`;

    case "conveyor":
      return `
        <rect x="54" y="144" width="292" height="28" rx="6" fill="#101e3a" stroke="#2d5a8e"/>
        <circle cx="78" cy="158" r="8" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="118" cy="158" r="8" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="158" cy="158" r="8" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="198" cy="158" r="8" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="238" cy="158" r="8" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="278" cy="158" r="8" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="318" cy="158" r="8" fill="#0d2040" stroke="#3a72b0"/>
        <rect x="86" y="104" width="56" height="34" rx="4" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="220" y="96" width="72" height="42" rx="4" fill="#162f55" stroke="#2d5a8e"/>`;

    case "plc":
      return `
        <rect x="118" y="54" width="164" height="134" rx="8" fill="#101e3a" stroke="#2d5a8e"/>
        <rect x="140" y="76" width="120" height="10" rx="2" fill="#1e3a5f"/>
        <rect x="140" y="98" width="120" height="10" rx="2" fill="#1e3a5f"/>
        <rect x="140" y="120" width="120" height="10" rx="2" fill="#1e3a5f"/>
        <rect x="140" y="142" width="120" height="10" rx="2" fill="#1e3a5f"/>
        <circle cx="150" cy="166" r="5" fill="#22c55e"/>
        <circle cx="170" cy="166" r="5" fill="#facc15"/>
        <circle cx="190" cy="166" r="5" fill="#ef4444"/>`;

    case "forklift":
      return `
        <rect x="92" y="128" width="110" height="42" rx="6" fill="#101e3a" stroke="#2d5a8e"/>
        <rect x="138" y="88" width="56" height="48" rx="5" fill="#162f55" stroke="#2d5a8e"/>
        <line x1="230" y1="74" x2="230" y2="178" stroke="#2d5a8e" stroke-width="5"/>
        <line x1="230" y1="170" x2="305" y2="170" stroke="#2d5a8e" stroke-width="5"/>
        <circle cx="120" cy="176" r="16" fill="#0d2040" stroke="#3a72b0"/>
        <circle cx="190" cy="176" r="16" fill="#0d2040" stroke="#3a72b0"/>`;

    case "motor":
      return `
        <rect x="96" y="98" width="174" height="72" rx="12" fill="#101e3a" stroke="#2d5a8e"/>
        <rect x="270" y="120" width="58" height="24" rx="4" fill="#162f55" stroke="#2d5a8e"/>
        <circle cx="136" cy="134" r="24" fill="#0d2040" stroke="#3a72b0"/>
        <line x1="98" y1="178" x2="326" y2="178" stroke="#1e3a5f" stroke-width="3"/>`;

    case "lighting":
      return `
        <rect x="88" y="62" width="224" height="32" rx="8" fill="#101e3a" stroke="#2d5a8e"/>
        <line x1="110" y1="94" x2="110" y2="152" stroke="#2d5a8e"/>
        <circle cx="110" cy="166" r="20" fill="#facc1520" stroke="#facc15"/>
        <line x1="160" y1="94" x2="160" y2="152" stroke="#2d5a8e"/>
        <circle cx="160" cy="166" r="20" fill="#facc1520" stroke="#facc15"/>
        <line x1="210" y1="94" x2="210" y2="152" stroke="#2d5a8e"/>
        <circle cx="210" cy="166" r="20" fill="#facc1520" stroke="#facc15"/>
        <line x1="260" y1="94" x2="260" y2="152" stroke="#2d5a8e"/>
        <circle cx="260" cy="166" r="20" fill="#facc1520" stroke="#facc15"/>`;

    case "case-packer":
      return `
        <rect x="62" y="104" width="120" height="72" rx="8" fill="#101e3a" stroke="#2d5a8e"/>
        <rect x="218" y="96" width="104" height="80" rx="8" fill="#101e3a" stroke="#2d5a8e"/>
        <rect x="92" y="126" width="60" height="28" rx="4" fill="#162f55" stroke="#2d5a8e"/>
        <rect x="240" y="120" width="58" height="34" rx="4" fill="#162f55" stroke="#2d5a8e"/>
        <line x1="182" y1="146" x2="218" y2="146" stroke="#2d5a8e" stroke-width="4"/>`;

    default:
      return `
        <rect x="82" y="82" width="236" height="104" rx="10" fill="#101e3a" stroke="#2d5a8e"/>
        <rect x="110" y="108" width="180" height="12" rx="2" fill="#1e3a5f"/>
        <rect x="110" y="136" width="120" height="12" rx="2" fill="#1e3a5f"/>
        <circle cx="278" cy="142" r="18" fill="#0d2040" stroke="#3a72b0"/>`;
  }
}

function equipmentSvg(label: string, subLabel: string, variant: EquipmentImageVariant): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280"><rect width="400" height="280" fill="#0a0f1e"/><defs><pattern id="g" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#162040" stroke-width="0.8"/></pattern><radialGradient id="glow" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.22"/><stop offset="100%" stop-color="#0a0f1e" stop-opacity="0"/></radialGradient></defs><rect width="400" height="280" fill="url(#g)"/><rect width="400" height="280" fill="url(#glow)"/>${iconFor(variant)}<text x="200" y="222" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#4a90d9" text-anchor="middle" letter-spacing="3">${label}</text><text x="200" y="240" font-family="system-ui,sans-serif" font-size="9" fill="#5d769f" text-anchor="middle" letter-spacing="2">${subLabel}</text></svg>`;
}

export function equipmentPlaceholderImage(
  label: string,
  subLabel: string,
  variant: EquipmentImageVariant,
): string {
  return encodeSvg(equipmentSvg(label, subLabel, variant));
}

export const EQUIPMENT_IMAGES = {
  palletiser:  equipmentPlaceholderImage("PALLETISER CELL",     "KUKA KR 210 R2700", "palletiser"),
  vialFiller:  equipmentPlaceholderImage("VIAL FILLING LINE",   "BOSCH VF-01",       "vial-filler"),
  hvac:        equipmentPlaceholderImage("CLEANROOM HVAC",      "GRADE B AHU",       "hvac"),
  boiler:      equipmentPlaceholderImage("STEAM BOILER",        "UTILITIES",         "boiler"),
  compressor:  equipmentPlaceholderImage("AIR COMPRESSOR",      "UTILITIES",         "compressor"),
  conveyor:    equipmentPlaceholderImage("CONVEYOR SYSTEM",     "PACKING LINE",      "conveyor"),
  plc:         equipmentPlaceholderImage("PLC CONTROL",         "AUTOMATION",        "plc"),
  forklift:    equipmentPlaceholderImage("WAREHOUSE FORKLIFT",  "MHE",               "forklift"),
  motor:       equipmentPlaceholderImage("PRESS LINE MOTOR",    "DRIVE SYSTEM",      "motor"),
  lighting:    equipmentPlaceholderImage("LIGHTING SYSTEM",     "FACILITIES",        "lighting"),
  casePacker:  equipmentPlaceholderImage("CASE PACKER",         "PACKING",           "case-packer"),
  generic:     equipmentPlaceholderImage("EQUIPMENT ASSET",     "VORTA",             "generic"),
};

export function resolveEquipmentImage(
  name: string | null | undefined,
  type: string | null | undefined,
  code: string | null | undefined,
): string {
  const h = `${name ?? ""} ${type ?? ""} ${code ?? ""}`.toLowerCase();

  if (h.includes("vial") || h.includes("filler") || h.includes("filling") || h.includes("vf-")) {
    return EQUIPMENT_IMAGES.vialFiller;
  }
  if (h.includes("hvac") || h.includes("ahu") || h.includes("cleanroom")) {
    return EQUIPMENT_IMAGES.hvac;
  }
  if (h.includes("palletis") || h.includes("palletiz") || h.includes("pl-")) {
    return EQUIPMENT_IMAGES.palletiser;
  }
  if (h.includes("case pack") || h.includes("case-pack") || h.includes("cp-")) {
    return EQUIPMENT_IMAGES.casePacker;
  }
  if (h.includes("boiler") || h.includes("steam") || h.includes("bl-")) {
    return EQUIPMENT_IMAGES.boiler;
  }
  if (h.includes("compressor") || h.includes("air comp") || h.includes("ac-")) {
    return EQUIPMENT_IMAGES.compressor;
  }
  if (h.includes("conveyor") || h.includes("cv-")) {
    return EQUIPMENT_IMAGES.conveyor;
  }
  if (h.includes("plc") || h.includes("automation")) {
    return EQUIPMENT_IMAGES.plc;
  }
  if (h.includes("forklift") || h.includes("warehouse") || h.includes("wf-")) {
    return EQUIPMENT_IMAGES.forklift;
  }
  if (h.includes("motor") || h.includes("press line") || h.includes("pm-")) {
    return EQUIPMENT_IMAGES.motor;
  }
  if (h.includes("lighting") || h.includes("light") || h.includes("lt-")) {
    return EQUIPMENT_IMAGES.lighting;
  }
  return EQUIPMENT_IMAGES.generic;
}
