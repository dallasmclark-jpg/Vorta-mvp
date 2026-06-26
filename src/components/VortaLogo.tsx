/**
 * Placeholder for the Vorta logo exported from Figma.
 * Replace the inner <svg> content with the actual asset once exported.
 * Expected: >< symbol + VORTA wordmark, approx 24px tall.
 */
export const VortaLogo = (): JSX.Element => {
  return (
    <svg
      width="96"
      height="24"
      viewBox="0 0 96 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Vorta"
      role="img"
    >
      {/* >< bracket symbol — replace with Figma path data */}
      <text
        x="0"
        y="18"
        fontFamily="monospace"
        fontSize="16"
        fontWeight="700"
        fill="#ffffff"
        letterSpacing="-0.5"
      >&gt;&lt;</text>
      {/* VORTA wordmark — replace with Figma path data */}
      <text
        x="26"
        y="18"
        fontFamily="sans-serif"
        fontSize="14"
        fontWeight="700"
        fill="#3b82f6"
        letterSpacing="2"
      >VORTA</text>
    </svg>
  );
};
