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

function hashName(name: string): number {
  let hash = 0;
  for (const character of name.trim().toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) & 0x7fffffff;
  }
  return hash;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const lastPart = parts[parts.length - 1];
  return `${parts[0]?.[0] ?? ""}${lastPart?.[0] ?? ""}`.toUpperCase();
}

/**
 * Deterministic demo portrait used until a customer-controlled profile photo URL
 * is supplied from Supabase Storage or an identity provider.
 */
export function getDemoProfilePhotoUrl(name: string): string {
  const portraitNumber = (hashName(name) % 70) + 1;
  return `https://i.pravatar.cc/160?img=${portraitNumber}`;
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
  const resolvedPhotoUrl = photoUrl?.trim() || getDemoProfilePhotoUrl(name);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedPhotoUrl]);

  const sharedClassName = `${sizeClass} ${shapeClass} ${className}`;

  if (failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden font-bold ${sharedClassName} ${fallbackClass}`}
        aria-label={`${name} profile photo unavailable`}
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
