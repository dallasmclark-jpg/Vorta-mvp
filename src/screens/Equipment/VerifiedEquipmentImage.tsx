import { useEffect, useRef, useState } from "react";
import { ImageOff, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth";
import {
  canManageVortaMedia,
  isVortaMediaEntityId,
  loadPreferredManagedImage,
  uploadManagedImage,
  VORTA_MEDIA_ACCEPT,
  type VortaManagedImage,
} from "../../lib/entityMedia";
import { resolveEquipmentImage } from "./equipmentImages";

interface VerifiedEquipmentImageProps {
  src: string | null | undefined;
  equipmentName: string;
  equipmentType?: string | null;
  equipmentCode?: string | null;
  equipmentId?: string | null;
  className?: string;
  imageClassName?: string;
  compact?: boolean;
}

export function VerifiedEquipmentImage({
  src,
  equipmentName,
  equipmentType,
  equipmentCode,
  equipmentId,
  className = "",
  imageClassName = "",
  compact = false,
}: VerifiedEquipmentImageProps): JSX.Element {
  const { siteContext } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [managedImage, setManagedImage] = useState<VortaManagedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const siteId = siteContext?.siteId ?? null;
  const persistedEquipmentId = isVortaMediaEntityId(equipmentId) ? equipmentId : null;
  const canUpload =
    Boolean(siteId && persistedEquipmentId) && canManageVortaMedia(siteContext?.role);

  useEffect(() => {
    let cancelled = false;
    setManagedImage(null);
    setUploadError(null);

    if (!siteId || !persistedEquipmentId) return () => undefined;

    void loadPreferredManagedImage(siteId, "equipment", persistedEquipmentId)
      .then((image) => {
        if (!cancelled) setManagedImage(image);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn("Vorta-managed equipment image could not be loaded:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistedEquipmentId, siteId]);

  const activeSrc = managedImage?.signedUrl ?? src;

  useEffect(() => {
    setFailed(false);
  }, [activeSrc]);

  const hasVerifiedImage = Boolean(activeSrc) && !failed;
  const fallback = resolveEquipmentImage(
    equipmentName,
    equipmentType,
    equipmentCode,
  );

  const handleFile = async (file: File): Promise<void> => {
    if (!siteId || !persistedEquipmentId || !canUpload) return;

    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadManagedImage({
        siteId,
        entityType: "equipment",
        entityId: persistedEquipmentId,
        file,
        altText: `Site photo for ${equipmentName}`,
      });
      setManagedImage(uploaded);
      setFailed(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117] ${className}`}
      data-vorta-equipment-image-state={
        managedImage ? "site-photo" : hasVerifiedImage ? "verified" : "unavailable"
      }
    >
      <img
        src={hasVerifiedImage ? activeSrc ?? fallback : fallback}
        alt={
          managedImage
            ? managedImage.altText ?? `Site photo for ${equipmentName}`
            : hasVerifiedImage
              ? `Verified product image for ${equipmentName}`
              : `Verified image unavailable for ${equipmentName}`
        }
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${hasVerifiedImage ? "object-contain" : "object-cover"} ${imageClassName}`}
        onError={() => setFailed(true)}
      />

      {canUpload ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={VORTA_MEDIA_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label={`Upload site image for ${equipmentName}`}
            title="Upload site image"
            className="absolute right-2 top-2 hidden h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-[#0d1117] text-slate-100 disabled:opacity-60 md:inline-flex"
          >
            {uploading ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </>
      ) : null}

      <span
        className={`absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md border border-gray-700 bg-[#0d1117] px-1.5 py-1 font-semibold ${
          compact ? "text-[8px]" : "text-[10px]"
        } ${managedImage || hasVerifiedImage ? "text-emerald-200" : "text-slate-300"}`}
      >
        {managedImage || hasVerifiedImage ? (
          <ShieldCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
        ) : (
          <ImageOff className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
        )}
        {managedImage
          ? "Vorta site photo"
          : hasVerifiedImage
            ? "Verified image"
            : "Awaiting verified image"}
      </span>

      {uploadError ? (
        <span
          role="alert"
          className="absolute inset-x-2 bottom-9 rounded-md border border-red-500/30 bg-[#0d1117] px-2 py-1.5 text-[10px] font-medium leading-4 text-red-200"
        >
          {uploadError}
        </span>
      ) : null}
    </div>
  );
}
