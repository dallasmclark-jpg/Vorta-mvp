import { useCallback, useEffect, useRef, useState } from "react";
import { ImageOff, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import {
  cacheVerifiedSourceImage,
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
  cacheVerifiedSource?: boolean;
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
  cacheVerifiedSource = true,
}: VerifiedEquipmentImageProps): JSX.Element {
  const { siteContext } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [managedImage, setManagedImage] = useState<VortaManagedImage | null>(null);
  const [cacheAttempted, setCacheAttempted] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const siteId = siteContext?.siteId ?? null;
  const persistedEquipmentId = isVortaMediaEntityId(equipmentId) ? equipmentId : null;
  const canUpload =
    Boolean(siteId && persistedEquipmentId) && canManageVortaMedia(siteContext?.role);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setManagedImage(null);
    setCacheAttempted(false);
    setUploadError(null);

    if (!visible || !siteId || !persistedEquipmentId) return () => undefined;

    void loadPreferredManagedImage(siteId, "equipment", persistedEquipmentId)
      .then(async (image) => {
        if (cancelled) return;
        setManagedImage(image);

        if (!image && cacheVerifiedSource && canUpload && src) {
          setCacheAttempted(true);
          try {
            const cached = await cacheVerifiedSourceImage("equipment", persistedEquipmentId);
            if (!cancelled) setManagedImage(cached);
          } catch (error) {
            if (!cancelled) {
              console.warn("Verified equipment image could not be cached in Vorta:", error);
            }
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn("Vorta-managed equipment image could not be loaded:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheVerifiedSource, canUpload, persistedEquipmentId, siteId, src, visible]);

  const activeSrc = managedImage?.signedUrl ?? src;

  useEffect(() => {
    setFailed(false);
    setImageExpanded(false);
  }, [activeSrc]);

  const hasVerifiedImage = Boolean(activeSrc) && !failed;
  const fallback = resolveEquipmentImage(
    equipmentName,
    equipmentType,
    equipmentCode,
  );

  const closeImage = useCallback(() => {
    setImageExpanded(false);
    window.requestAnimationFrame(() => imageButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!imageExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeImage();
    };

    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeImage, imageExpanded]);

  const handleImageError = async (): Promise<void> => {
    if (!managedImage && !cacheAttempted && canUpload && persistedEquipmentId) {
      setCacheAttempted(true);
      try {
        const cached = await cacheVerifiedSourceImage("equipment", persistedEquipmentId);
        setManagedImage(cached);
        setFailed(false);
        return;
      } catch (error) {
        console.warn("Verified equipment image cache fallback failed:", error);
      }
    }
    setImageExpanded(false);
    setFailed(true);
  };

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

  const managedLabel =
    managedImage?.sourceType === "site_photo" ? "Vorta site photo" : "Vorta stored image";
  const activeAltText = managedImage
    ? managedImage.altText ?? `${equipmentName} image stored in Vorta`
    : `Verified product image for ${equipmentName}`;

  return (
    <>
      <div
        ref={rootRef}
        className={`relative overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117] ${className}`}
        data-vorta-equipment-image="true"
        data-vorta-equipment-image-state={
          managedImage ? managedImage.sourceType : hasVerifiedImage ? "verified" : "unavailable"
        }
      >
        {hasVerifiedImage ? (
          <button
            ref={imageButtonRef}
            type="button"
            onClick={() => setImageExpanded(true)}
            aria-label={`Enlarge image of ${equipmentName}`}
            className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            style={{ cursor: "zoom-in" }}
          >
            <img
              src={activeSrc ?? undefined}
              alt={activeAltText}
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-contain ${imageClassName}`}
              onError={() => void handleImageError()}
            />
          </button>
        ) : (
          <img
            src={fallback}
            alt={`Verified image unavailable for ${equipmentName}`}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover ${imageClassName}`}
          />
        )}

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
          className={`pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md border border-gray-700 bg-[#0d1117] px-1.5 py-1 font-semibold ${
            compact ? "text-[8px]" : "text-[10px]"
          } ${managedImage || hasVerifiedImage ? "text-emerald-200" : "text-slate-300"}`}
        >
          {managedImage || hasVerifiedImage ? (
            <ShieldCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
          ) : (
            <ImageOff className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
          )}
          {managedImage ? managedLabel : hasVerifiedImage ? "Verified image" : "Awaiting verified image"}
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

      {hasVerifiedImage && imageExpanded && activeSrc ? (
        <div
          data-vorta-equipment-image-lightbox="true"
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged image of ${equipmentName}`}
          className="fixed inset-0 flex items-center justify-center p-3"
          style={{ zIndex: 100, backgroundColor: "rgba(0, 0, 0, 0.9)" }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeImage();
          }}
        >
          <div
            className="relative flex flex-col overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117]"
            style={{ height: "92dvh", width: "96vw", maxWidth: "1600px" }}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeImage}
              aria-label="Close enlarged image"
              className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              style={{ zIndex: 10 }}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="min-h-0 flex-1 p-4">
              <img
                src={activeSrc}
                alt={activeAltText}
                decoding="async"
                onError={() => void handleImageError()}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="border-t border-gray-800 bg-[#141820] px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-100">{equipmentName}</p>
              <p className="mt-1 text-xs text-slate-400">
                {[equipmentCode, equipmentType].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
