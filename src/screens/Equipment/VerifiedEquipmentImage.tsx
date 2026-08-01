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

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117] ${className}`}
      data-vorta-equipment-image-state={hasVerifiedImage ? "verified" : "unavailable"}
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
        className={`absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-1 font-semibold backdrop-blur ${
          compact ? "text-[8px]" : "text-[10px]"
        } ${
          hasVerifiedImage
            ? "border-emerald-500/30 bg-emerald-950/85 text-emerald-200"
            : "border-slate-600/50 bg-slate-950/85 text-slate-300"
        }`}
      >
        {hasVerifiedImage ? (
          <ShieldCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
        ) : (
          <ImageOff className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
        )}
        {hasVerifiedImage ? "Verified image" : "Awaiting verified image"}
      </span>
    </div>
  );
}
