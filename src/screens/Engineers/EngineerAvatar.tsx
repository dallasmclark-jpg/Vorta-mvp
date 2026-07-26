import { useEffect, useMemo, useState } from "react";

const AVATAR_TONES = [
  "bg-blue-500/15 text-blue-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-amber-500/15 text-amber-300",
  "bg-cyan-500/15 text-cyan-300",
  "bg-violet-500/15 text-violet-300",
  "bg-rose-500/15 text-rose-300",
] as const;

const SIZE_CLASSES = {
  sm: "h-9 w-9 rounded-lg text-xs",
  md: "h-11 w-11 rounded-xl text-sm",
  lg: "h-14 w-14 rounded-2xl text-base",
} as const;

export function engineerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function avatarTone(name: string): string {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) & 0xffff;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function normaliseAvatarUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, window.location.origin);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function EngineerAvatar({
  name,
  avatarUrl,
  size = "md",
  eager = false,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  eager?: boolean;
}): JSX.Element {
  const resolvedUrl = useMemo(() => normaliseAvatarUrl(avatarUrl), [avatarUrl]);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedUrl]);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden font-semibold ${SIZE_CLASSES[size]} ${avatarTone(name)}`}
      data-vorta-engineer-avatar="true"
    >
      <span aria-hidden={Boolean(resolvedUrl) && !imageFailed}>
        {engineerInitials(name)}
      </span>
      {resolvedUrl && !imageFailed ? (
        <img
          src={resolvedUrl}
          alt={`${name} profile`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          data-vorta-engineer-avatar-image="true"
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </div>
  );
}
