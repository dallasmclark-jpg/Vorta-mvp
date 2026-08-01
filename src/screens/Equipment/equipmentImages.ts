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

/**
 * A deliberately neutral missing-image state.
 *
 * This is not an illustration of the asset and must never be described as one.
 * Verified operational imagery comes from equipment_assets.image_url together
 * with its recorded source and verification metadata.
 */
function unavailableImage(): string {
  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280" role="img" aria-label="Verified equipment image unavailable">
      <rect width="400" height="280" fill="#0d1117"/>
      <rect x="44" y="38" width="312" height="204" rx="16" fill="#111827" stroke="#334155" stroke-width="2" stroke-dasharray="8 8"/>
      <rect x="150" y="86" width="100" height="76" rx="10" fill="none" stroke="#64748b" stroke-width="4"/>
      <circle cx="180" cy="112" r="9" fill="#64748b"/>
      <path d="M158 150l28-27 20 19 16-14 20 22" fill="none" stroke="#64748b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="200" y="194" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#cbd5e1" text-anchor="middle">VERIFIED IMAGE UNAVAILABLE</text>
      <text x="200" y="215" font-family="system-ui,sans-serif" font-size="10" fill="#64748b" text-anchor="middle">No unverified substitute is shown</text>
    </svg>
  `);
}

const VERIFIED_IMAGE_UNAVAILABLE = unavailableImage();

/**
 * Kept for compatibility with legacy/demo callers. All variants intentionally
 * resolve to the same explicit no-image state rather than a fabricated machine.
 */
export function equipmentPlaceholderImage(
  _label: string,
  _subLabel: string,
  _variant: EquipmentImageVariant,
): string {
  return VERIFIED_IMAGE_UNAVAILABLE;
}

export const EQUIPMENT_IMAGES = {
  palletiser: VERIFIED_IMAGE_UNAVAILABLE,
  vialFiller: VERIFIED_IMAGE_UNAVAILABLE,
  hvac: VERIFIED_IMAGE_UNAVAILABLE,
  boiler: VERIFIED_IMAGE_UNAVAILABLE,
  compressor: VERIFIED_IMAGE_UNAVAILABLE,
  conveyor: VERIFIED_IMAGE_UNAVAILABLE,
  plc: VERIFIED_IMAGE_UNAVAILABLE,
  forklift: VERIFIED_IMAGE_UNAVAILABLE,
  motor: VERIFIED_IMAGE_UNAVAILABLE,
  lighting: VERIFIED_IMAGE_UNAVAILABLE,
  casePacker: VERIFIED_IMAGE_UNAVAILABLE,
  generic: VERIFIED_IMAGE_UNAVAILABLE,
};

export function resolveEquipmentImage(
  _name: string | null | undefined,
  _type: string | null | undefined,
  _code: string | null | undefined,
): string {
  return VERIFIED_IMAGE_UNAVAILABLE;
}
