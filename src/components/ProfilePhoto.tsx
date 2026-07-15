import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type WorkforceEntityType = "engineer" | "operator" | "profile";

interface ProfilePhotoProps {
  name: string;
  photoUrl?: string | null;
  entityType?: WorkforceEntityType;
  entityId?: string | null;
  sizeClass?: string;
  shapeClass?: string;
  fallbackClass?: string;
  fallbackText?: string;
  className?: string;
  alt?: string;
  eager?: boolean;
}

const avatarCache = new Map<string, string | null>();

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
  entityType,
  entityId,
  sizeClass = "h-10 w-10",
  shapeClass = "rounded-xl",
  fallbackClass = "bg-slate-800 text-slate-300",
  fallbackText,
  className = "",
  alt,
  eager = false,
}: ProfilePhotoProps): JSX.Element {
  const suppliedPhotoUrl = photoUrl?.trim() || null;
  const cacheKey = entityType && entityId ? `${entityType}:${entityId}` : null;
  const [databasePhotoUrl, setDatabasePhotoUrl] = useState<string | null>(() =>
    cacheKey ? avatarCache.get(cacheKey) ?? null : null,
  );
  const resolvedPhotoUrl = suppliedPhotoUrl || databasePhotoUrl;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (suppliedPhotoUrl || !entityType || !entityId || !cacheKey) {
      setDatabasePhotoUrl(null);
      return () => {
        cancelled = true;
      };
    }

    if (avatarCache.has(cacheKey)) {
      setDatabasePhotoUrl(avatarCache.get(cacheKey) ?? null);
      return () => {
        cancelled = true;
      };
    }

    void supabase
      .rpc("vorta_get_workforce_avatar", {
        p_entity_type: entityType,
        p_entity_id: entityId,
      })
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        const row = data as { avatar_url?: unknown } | null;
        const url =
          !error && typeof row?.avatar_url === "string"
            ? row.avatar_url.trim() || null
            : null;
        avatarCache.set(cacheKey, url);
        setDatabasePhotoUrl(url);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, entityId, entityType, suppliedPhotoUrl]);

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
