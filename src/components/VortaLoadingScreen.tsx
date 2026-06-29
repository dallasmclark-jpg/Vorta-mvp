// Full-screen Vorta branded loader.
// Uses SVG squircle with a travelling blue pulse on the border.
// Respects prefers-reduced-motion — animation is disabled when set.
export function VortaLoadingScreen() {
  // Squircle path: 120×120 viewBox, rx=28 rounded rect perimeter ≈ 393px
  const PERIMETER = 393;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0e14",
        gap: "28px",
        zIndex: 9999,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @keyframes vls-pulse {
          0%   { stroke-dashoffset: ${PERIMETER}; }
          100% { stroke-dashoffset: ${-PERIMETER}; }
        }
        @keyframes vls-glow {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vls-pulse-track { animation: none !important; }
          .vls-glow        { animation: none !important; opacity: 0.7; }
        }
      `}</style>

      {/* Outer glow halo */}
      <div
        className="vls-glow"
        style={{
          position: "absolute",
          width: "180px",
          height: "180px",
          borderRadius: "44px",
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.22) 0%, transparent 72%)",
          animation: "vls-glow 2.4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "relative", zIndex: 1 }}
      >
        <defs>
          {/* Blue pulse gradient — bright head fading to transparent */}
          <linearGradient id="vls-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#60a5fa" stopOpacity="0" />
            <stop offset="60%"  stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Squircle background fill */}
        <rect x="4" y="4" width="112" height="112" rx="28" ry="28"
          fill="#0d1117"
        />

        {/* Static dim border */}
        <rect x="4" y="4" width="112" height="112" rx="28" ry="28"
          stroke="#1e3a5f"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Travelling pulse — dashed segment animated around the squircle border */}
        <rect
          className="vls-pulse-track"
          x="4" y="4" width="112" height="112" rx="28" ry="28"
          stroke="url(#vls-grad)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${PERIMETER * 0.22} ${PERIMETER * 0.78}`}
          strokeDashoffset={PERIMETER}
          style={{
            animation: "vls-pulse 2s linear infinite",
            filter: "drop-shadow(0 0 5px #3b82f6) drop-shadow(0 0 12px rgba(59,130,246,0.6))",
          }}
        />

        {/* Official Vorta logomark — paths from VortaLogo.tsx, viewBox 0 0 78 44
            Scaled to ~54×30.5 and centred in the 112×112 inner area (centre = 60,60) */}
        <svg x="33" y="45" width="54" height="30.5" viewBox="0 0 78 44" fill="none">
          <path d="M78 44L48.2658 26.4635C46.7603 25.5598 44 23.8524 44 22H51.0345L78 38.2105V44Z" fill="#F8FAFC"/>
          <path d="M78 0L48.2658 17.5365C46.7603 18.4402 44 20.1476 44 22H51.0345L78 5.78947V0Z" fill="#F8FAFC"/>
          <path d="M0 44L29.7342 26.4635C31.2397 25.5598 34 23.8524 34 22H26.9655L0 38.2105V44Z" fill="#F8FAFC"/>
          <path d="M0 0L29.7342 17.5365C31.2397 18.4402 34 20.1476 34 22H26.9655L0 5.78947V0Z" fill="#F8FAFC"/>
        </svg>
      </svg>

      {/* "Loading…" label */}
      <span
        style={{
          fontSize: "13px",
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: "#60a5fa",
          opacity: 0.7,
          position: "relative",
          zIndex: 1,
        }}
      >
        Loading…
      </span>
    </div>
  );
}
