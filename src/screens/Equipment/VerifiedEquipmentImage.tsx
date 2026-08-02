import { useEffect, useState } from "react";
import { ImageOff, ShieldCheck } from "lucide-react";
import { resolveEquipmentImage } from "./equipmentImages";

interface VerifiedEquipmentImageProps {
  src: string | null | undefined;
  equipmentName: string;
  equipmentType?: string | null;
  equipmentCode?: string | null;
  className?: string;
  imageClassName?: string;
  compact?: boolean;
}

export function VerifiedEquipmentImage({
  src,
  equipmentName,
  equipmentType,
  equipmentCode,
  className = "",
  imageClassName = "",
  compact = false,
}: VerifiedEquipmentImageProps): JSX.Element {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const hasVerifiedImage = Boolean(src) && !failed;
  const fallback = resolveEquipmentImage(
    equipmentName,
    equipmentType,
    equipmentCode,
  );

  if (compact) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117] ${className}`}
        data-vorta-equipment-image-state={hasVerifiedImage ? "verified" : "unavailable"}
        data-vorta-equipment-image-layout="compact"
        role={hasVerifiedImage ? undefined : "img"}
        aria-label={
          hasVerifiedImage ? undefined : `Verified image unavailable for ${equipmentName}`
        }
      >
        {hasVerifiedImage ? (
          <img
            src={src ?? fallback}
            alt={`Verified product image for ${equipmentName}`}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-contain ${imageClassName}`}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900/70 px-2 text-center text-slate-500">
            <ImageOff className="h-5 w-5" aria-hidden="true" />
            <span className="text-[9px] font-semibold leading-tight">No verified image</span>
          </div>
        )}

        {hasVerifiedImage ? (
          <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-950/90 text-emerald-200 backdrop-blur">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">Verified image</span>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117] ${className}`}
      data-vorta-equipment-image-state={hasVerifiedImage ? "verified" : "unavailable"}
      data-vorta-equipment-image-layout="full"
    >
      <img
        src={hasVerifiedImage ? src ?? fallback : fallback}
        alt={
          hasVerifiedImage
            ? `Verified product image for ${equipmentName}`
            : `Verified image unavailable for ${equipmentName}`
        }
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${hasVerifiedImage ? "object-contain" : "object-cover"} ${imageClassName}`}
        onError={() => setFailed(true)}
      />

      <span
        className={`absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold backdrop-blur ${
          hasVerifiedImage
            ? "border-emerald-500/30 bg-emerald-950/85 text-emerald-200"
            : "border-slate-600/50 bg-slate-950/85 text-slate-300"
        }`}
      >
        {hasVerifiedImage ? (
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ImageOff className="h-3 w-3" aria-hidden="true" />
        )}
        {hasVerifiedImage ? "Verified image" : "Awaiting verified image"}
      </span>
    </div>
  );
}
