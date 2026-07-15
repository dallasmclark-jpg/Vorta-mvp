import { useEffect, useState } from "react";

interface ProfilePhotoProps {
  name: string;
  photoUrl?: string | null;
  sizeClass?: string;
  shapeClass?: string;
  fallbackClass?: string;
  fallbackText?: string;
  className?: string;
  alt?: string;
  eager?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const lastPart = parts[parts.length - 1];
  return `${parts[0]?.[0] ?? ""}${lastPart?.[0] ?? ""}`.toUpperCase();
}

/**
 * @deprecated Profile portraits now come from the workforce record in Supabase.
 * Retained temporarily so older imports continue to compile while pages migrate.
 */
export function getDemoProfilePhotoUrl(_name: string): string {
  return "";
}

export function ProfilePhoto({
  name,
  photoUrl,
  sizeClass = "h-10 w-10",
  shapeClass = "rounded-xl",
  fallbackClass = "bg-slate-800 text-slate-300",
  fallbackText,
  className = "",
  alt,
  eager = false,
}: ProfilePhotoProps): JSX.Element {
  const resolvedPhotoUrl = photoUrl?.trim() || null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedPhotoUrl]);

  const sharedClassName = `${sizeClass} ${shapeClass} ${className}`;

  if (!resolvedPhotoUrl || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden font-bold ${sharedClassName} ${fallbackClass}`}
        aria-label={resolvedPhotoUrl ? `${name} profile photo unavailable` : `${name} initials`}
      >
        {fallbackText ?? getInitials(name)}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/10 bg-slate-900 ${sharedClassName}`}
    >
      <img
        src={resolvedPhotoUrl}
        alt={alt ?? `${name} profile photo`}
        className="h-full w-full object-cover object-center"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      <span
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5"
        aria-hidden="true"
      />
    </div>
  );
}
