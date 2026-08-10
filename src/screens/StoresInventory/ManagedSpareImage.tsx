import {
  ExternalLink,
  Package,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  canManageVortaMedia,
  loadPreferredManagedImage,
  uploadManagedImage,
  VORTA_MEDIA_ACCEPT,
  type VortaManagedImage,
} from "../../lib/entityMedia";
import type { PilotRole } from "../../lib/auth";

interface ManagedSpareImageProps {
  siteId: string;
  role: PilotRole | null | undefined;
  componentId: string;
  partName: string;
  manufacturer: string;
  oemPartNumber: string | null;
  oemUrl: string | null;
  fallbackImageUrl: string | null;
  fallbackFullImageUrl: string | null;
  fallbackAltText: string;
  fallbackSourceType: string | null;
}

export function ManagedSpareImage({
  siteId,
  role,
  componentId,
  partName,
  manufacturer,
  oemPartNumber,
  oemUrl,
  fallbackImageUrl,
  fallbackFullImageUrl,
  fallbackAltText,
  fallbackSourceType,
}: ManagedSpareImageProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [managedImage, setManagedImage] = useState<VortaManagedImage | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [fullImageFailed, setFullImageFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canUpload = canManageVortaMedia(role);

  useEffect(() => {
    let cancelled = false;
    setManagedImage(null);
    setUploadError(null);

    void loadPreferredManagedImage(siteId, "spare", componentId)
      .then((image) => {
        if (!cancelled) setManagedImage(image);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn("Vorta-managed spare image could not be loaded:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [componentId, siteId]);

  const activeImageUrl = managedImage?.signedUrl ?? fallbackImageUrl;
  const activeFullImageUrl = managedImage?.signedUrl ?? fallbackFullImageUrl ?? fallbackImageUrl;
  const activeAltText = managedImage?.altText ?? fallbackAltText;

  useEffect(() => {
    setImageFailed(false);
    setImageExpanded(false);
    setFullImageFailed(false);
  }, [activeImageUrl, activeFullImageUrl]);

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

  const handleUpload = async (file: File): Promise<void> => {
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadManagedImage({
        siteId,
        entityType: "spare",
        entityId: componentId,
        file,
        altText: `Site photo for ${partName}`,
      });
      setManagedImage(uploaded);
      setImageFailed(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const showImage = Boolean(activeImageUrl) && !imageFailed;
  const lightboxImageUrl =
    fullImageFailed || !activeFullImageUrl ? activeImageUrl : activeFullImageUrl;
  const sourceLabel = managedImage
    ? "Vorta site photo"
    : fallbackSourceType === "manufacturer"
      ? "Verified manufacturer image"
      : fallbackSourceType === "authorised_supplier"
        ? "Verified supplier image"
        : fallbackSourceType === "site_photo"
          ? "Verified site image"
          : "Verified spare image";

  return (
    <>
      <div
        data-vorta-spare-image="true"
        data-vorta-managed-media={managedImage ? "site-photo" : "fallback"}
        className="w-full shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117]"
        style={{ maxWidth: "10rem" }}
      >
        <div
          className="relative flex items-center justify-center bg-[#0d1117]"
          style={{ aspectRatio: "1 / 1" }}
        >
          {showImage ? (
            <button
              ref={imageButtonRef}
              type="button"
              onClick={() => {
                setFullImageFailed(false);
                setImageExpanded(true);
              }}
              aria-label={`Enlarge image of ${partName}`}
              className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/60"
              style={{ cursor: "zoom-in" }}
            >
              <img
                src={activeImageUrl ?? undefined}
                alt={activeAltText}
                loading="lazy"
                decoding="async"
                onError={() => setImageFailed(true)}
                className="h-full w-full object-contain p-3"
              />
            </button>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-500">
              <Package className="h-8 w-8" aria-hidden="true" />
              <span className="text-xs font-medium leading-5">
                No verified image available
              </span>
            </div>
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
                  if (file) void handleUpload(file);
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                aria-label={`Upload site image for ${partName}`}
                title="Upload site image"
                className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/70 bg-slate-950/90 text-slate-100 shadow-sm hover:border-blue-400 hover:text-blue-200 disabled:cursor-wait disabled:opacity-70"
              >
                {uploading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 border-t border-gray-800 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-500">
            {showImage ? sourceLabel : "Image unavailable"}
          </p>
          {oemUrl ? (
            <a
              href={oemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              style={{ width: "fit-content" }}
            >
              View OEM product
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
          {uploadError ? (
            <p role="alert" className="mt-1 text-[10px] font-medium leading-4 text-red-300">
              {uploadError}
            </p>
          ) : null}
        </div>
      </div>

      {showImage && imageExpanded && lightboxImageUrl ? (
        <div
          data-vorta-spare-image-lightbox="true"
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged image of ${partName}`}
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
                src={lightboxImageUrl}
                alt={activeAltText}
                decoding="async"
                onError={() => {
                  if (!fullImageFailed && activeImageUrl) {
                    setFullImageFailed(true);
                  } else {
                    closeImage();
                  }
                }}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-800 bg-[#141820] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{partName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {manufacturer}{oemPartNumber ? ` · ${oemPartNumber}` : ""}
                </p>
              </div>
              {oemUrl ? (
                <a
                  href={oemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/[0.09] px-3 py-2 text-sm font-semibold text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  style={{ minHeight: "2.5rem" }}
                >
                  View OEM product
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
