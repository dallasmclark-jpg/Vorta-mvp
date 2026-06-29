// Full-screen Vorta branded loader.
// Uses SVG squircle with a travelling blue pulse on the border.
// Fades out over 250ms when unmounted via the fadeOut prop.
// Respects prefers-reduced-motion — pulse animation is disabled when set.

import { useEffect, useState } from "react";

interface VortaLoadingScreenProps {
  fadeOut?: boolean;
}

export function VortaLoadingScreen({ fadeOut = false }: VortaLoadingScreenProps) {
  const PERIMETER = 341;

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
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 250ms ease-out",
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes vls-pulse {
          0%   { stroke-dashoffset: ${PERIMETER}; }
          100% { stroke-dashoffset: ${-PERIMETER}; }
        }
        @keyframes vls-halo {
          0%, 100% { opacity: 0.22; }
          50%       { opacity: 0.42; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vls-pulse-track { animation: none !important; }
          .vls-halo-div    { animation: none !important; opacity: 0.28; }
        }
      `}</style>

      {/* Subtle outer glow — pulse provides the primary visual focus */}
      <div
        className="vls-halo-div"
        style={{
          position: "absolute",
          width: "155px",
          height: "155px",
          borderRadius: "38px",
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.05) 0%, transparent 70%)",
          animation: "vls-halo 2.4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <svg
        width="104"
        height="104"
        viewBox="0 0 104 104"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "relative", zIndex: 1 }}
      >
        <defs>
          <linearGradient id="vls-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#60a5fa" stopOpacity="0" />
            <stop offset="60%"  stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="1" />
          </linearGradient>
        </defs>

        <rect x="4" y="4" width="96" height="96" rx="24" ry="24" fill="#0d1117" />

        {/* Static dim border */}
        <rect x="4" y="4" width="96" height="96" rx="24" ry="24"
          stroke="#1a2e4a"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Travelling pulse */}
        <rect
          className="vls-pulse-track"
          x="4" y="4" width="96" height="96" rx="24" ry="24"
          stroke="url(#vls-grad)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${PERIMETER * 0.22} ${PERIMETER * 0.78}`}
          strokeDashoffset={PERIMETER}
          style={{
            animation: "vls-pulse 2s linear infinite",
            filter: "drop-shadow(0 0 4px #3b82f6) drop-shadow(0 0 10px rgba(59,130,246,0.5))",
          }}
        />

        {/* Official Vorta logomark — viewBox 0 0 78 44, scaled to 50×28.2, centred at (52,52) */}
        <svg x="27" y="38" width="50" height="28.2" viewBox="0 0 78 44" fill="none">
          <path d="M78 44L48.2658 26.4635C46.7603 25.5598 44 23.8524 44 22H51.0345L78 38.2105V44Z" fill="#F8FAFC"/>
          <path d="M78 0L48.2658 17.5365C46.7603 18.4402 44 20.1476 44 22H51.0345L78 5.78947V0Z" fill="#F8FAFC"/>
          <path d="M0 44L29.7342 26.4635C31.2397 25.5598 34 23.8524 34 22H26.9655L0 38.2105V44Z" fill="#F8FAFC"/>
          <path d="M0 0L29.7342 17.5365C31.2397 18.4402 34 20.1476 34 22H26.9655L0 5.78947V0Z" fill="#F8FAFC"/>
        </svg>
      </svg>
    </div>
  );
}

// Suspense fallback that waits 250ms before showing the loader, preventing
// a flash for chunks that load quickly from cache.
export function DelayedLoader() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, []);
  return show ? <VortaLoadingScreen /> : null;
}
