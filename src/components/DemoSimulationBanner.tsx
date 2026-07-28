type DemoSimulationBannerProps = {
  title: string;
  description: string;
};

/**
 * Retained as a compatibility boundary for existing route imports.
 * Demo statements were removed from the Maintenance Manager experience under VOR-017.
 */
export function DemoSimulationBanner(
  _props: DemoSimulationBannerProps,
): null {
  return null;
}
