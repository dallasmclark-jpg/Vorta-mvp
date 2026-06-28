/**
 * Official Vorta branding components.
 *
 * VortaLogo  — full horizontal lockup (icon + wordmark). Use in expanded sidebars and login.
 * VortaIcon  — icon mark only (the >< motif). Use in collapsed sidebars and mobile headers.
 */

interface LogoProps {
  className?: string;
}

export const VortaIcon = ({ className = "" }: LogoProps): JSX.Element => (
  <span
    aria-label="Vorta"
    role="img"
    className={`inline-flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-[#1e2535] ${className}`}
  >
    <span
      aria-hidden="true"
      className="font-mono text-[13px] font-black leading-none tracking-[-2px] text-white"
    >
      {">&lt;".replace("&lt;", "<")}
    </span>
  </span>
);

export const VortaLogo = ({ className = "" }: LogoProps): JSX.Element => (
  <span
    aria-label="Vorta"
    role="img"
    className={`inline-flex shrink-0 select-none items-center gap-2.5 ${className}`}
  >
    {/* Icon mark */}
    <span
      aria-hidden="true"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#1e2535]"
    >
      <span className="font-mono text-[12px] font-black leading-none tracking-[-2px] text-white">
        &gt;&lt;
      </span>
    </span>

    {/* Wordmark */}
    <span className="flex flex-col leading-none">
      <span className="text-[13px] font-bold tracking-[0.18em] text-white uppercase">
        Vorta
      </span>
      <span className="text-[8px] font-medium tracking-[0.22em] text-slate-500 uppercase">
        Platform
      </span>
    </span>
  </span>
);
