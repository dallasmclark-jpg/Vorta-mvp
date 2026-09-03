import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, QrCode, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getEquipmentList,
  type EquipmentListItem,
} from "../Equipment/equipmentService";

type ScannerState = "idle" | "starting" | "scanning" | "error";

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function candidateValues(rawValue: string): string[] {
  const raw = rawValue.trim();
  const values = new Set<string>();
  if (!raw) return [];

  values.add(raw);

  try {
    const parsedJson = JSON.parse(raw) as Record<string, unknown>;
    for (const key of ["equipmentId", "equipment_id", "assetId", "asset_id", "assetNumber", "asset_number", "id"]) {
      const value = parsedJson[key];
      if (typeof value === "string" && value.trim()) values.add(value.trim());
    }
  } catch {
    // Most QR codes are not JSON.
  }

  try {
    const url = new URL(raw, window.location.origin);
    for (const key of ["equipment", "equipmentId", "equipment_id", "asset", "assetId", "asset_id", "assetNumber", "asset_number", "id"]) {
      const value = url.searchParams.get(key);
      if (value?.trim()) values.add(value.trim());
    }

    const equipmentPathMatch = url.pathname.match(/\/engineer\/equipment\/([^/?#]+)/i);
    if (equipmentPathMatch?.[1]) {
      values.add(decodeURIComponent(equipmentPathMatch[1]));
    }
  } catch {
    // Raw asset numbers and IDs are valid too.
  }

  return [...values];
}

function matchEquipment(rawValue: string, equipment: EquipmentListItem[]): EquipmentListItem | null {
  const candidates = candidateValues(rawValue).map(normalise);
  if (!candidates.length) return null;

  return equipment.find((asset) => {
    const identifiers = [asset.id, asset.assetNumber]
      .filter(Boolean)
      .map((value) => normalise(String(value)));
    return candidates.some((candidate) => identifiers.includes(candidate));
  }) ?? null;
}

export function EngineerQrScannerBridge(): JSX.Element | null {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const equipmentRef = useRef<EquipmentListItem[]>([]);
  const lastValueRef = useRef("");

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ScannerState>("idle");
  const [message, setMessage] = useState("");

  const stopCamera = (): void => {
    if (scanTimerRef.current != null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const closeScanner = (): void => {
    stopCamera();
    setOpen(false);
    setState("idle");
    setMessage("");
    lastValueRef.current = "";

    if (location.pathname === "/engineer/equipment" && new URLSearchParams(location.search).get("scan") === "1") {
      navigate("/engineer/equipment", { replace: true });
    }
  };

  const beginScan = (): void => {
    setOpen(true);
    setState("starting");
    setMessage("Opening camera…");
  };

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const equipmentPage = button.closest('[data-vorta-engineer-equipment="true"]');
      if (!equipmentPage) return;
      if (!button.textContent?.includes("Scan QR / Barcode")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      beginScan();
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === "/engineer/equipment" && params.get("scan") === "1" && !open) {
      beginScan();
    }
  }, [location.pathname, location.search, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const start = async (): Promise<void> => {
      try {
        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        if (!BarcodeDetectorCtor) {
          throw new Error("Live QR scanning is not supported by this browser. Use Chrome on Android or another browser with BarcodeDetector support.");
        }

        const supportedFormats: string[] = typeof BarcodeDetectorCtor.getSupportedFormats === "function"
          ? await BarcodeDetectorCtor.getSupportedFormats()
          : ["qr_code"];
        const preferredFormats = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "data_matrix"]
          .filter((format) => supportedFormats.includes(format));

        detectorRef.current = new BarcodeDetectorCtor({
          formats: preferredFormats.length ? preferredFormats : ["qr_code"],
        });

        const [equipment, stream] = await Promise.all([
          getEquipmentList(),
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          }),
        ]);

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        equipmentRef.current = equipment;
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error("Camera preview could not be created.");
        video.srcObject = stream;
        await video.play();

        setState("scanning");
        setMessage("Point the camera at the equipment QR code or barcode.");

        const scan = async (): Promise<void> => {
          if (cancelled || !videoRef.current || !detectorRef.current) return;

          try {
            if (videoRef.current.readyState >= 2) {
              const results = await detectorRef.current.detect(videoRef.current);
              const rawValue = results?.[0]?.rawValue?.trim?.() ?? "";

              if (rawValue && rawValue !== lastValueRef.current) {
                lastValueRef.current = rawValue;
                const matched = matchEquipment(rawValue, equipmentRef.current);

                if (matched) {
                  stopCamera();
                  setOpen(false);
                  navigate(`/engineer/equipment/${encodeURIComponent(matched.id)}`);
                  return;
                }

                setMessage(`Code read, but it is not linked to an authorised Vorta asset: ${rawValue}`);
                window.setTimeout(() => {
                  lastValueRef.current = "";
                  setMessage("Point the camera at the equipment QR code or barcode.");
                }, 1600);
              }
            }
          } catch (error) {
            console.warn("Engineer QR scan frame failed:", error);
          }

          scanTimerRef.current = window.setTimeout(() => void scan(), 220);
        };

        void scan();
      } catch (error) {
        if (cancelled) return;
        stopCamera();
        setState("error");
        setMessage(error instanceof Error ? error.message : "The camera could not be opened for scanning.");
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, navigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#000814] text-white md:inset-4 md:rounded-2xl md:border md:border-slate-800">
      <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-slate-800/80 px-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <QrCode className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Scan Equipment</h2>
            <p className="text-xs text-slate-500">Open the linked Vorta asset</p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeScanner}
          aria-label="Close equipment scanner"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-white/[0.05] hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className="relative aspect-square w-[min(76vw,22rem)] rounded-3xl border-2 border-blue-400/80 shadow-[0_0_0_9999px_rgba(0,8,20,0.46)]">
            <span className="absolute -left-0.5 -top-0.5 h-12 w-12 rounded-tl-3xl border-l-4 border-t-4 border-blue-400" />
            <span className="absolute -right-0.5 -top-0.5 h-12 w-12 rounded-tr-3xl border-r-4 border-t-4 border-blue-400" />
            <span className="absolute -bottom-0.5 -left-0.5 h-12 w-12 rounded-bl-3xl border-b-4 border-l-4 border-blue-400" />
            <span className="absolute -bottom-0.5 -right-0.5 h-12 w-12 rounded-br-3xl border-b-4 border-r-4 border-blue-400" />
          </div>
        </div>

        {(state === "starting" || state === "error") && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#000814]/85 p-6 text-center">
            <div className="max-w-sm">
              {state === "starting" ? (
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
              ) : (
                <Camera className="mx-auto h-8 w-8 text-amber-400" />
              )}
              <p className="mt-4 text-sm leading-6 text-slate-300">{message}</p>
              {state === "error" && (
                <button type="button" onClick={closeScanner} className="mt-5 min-h-11 rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-200">
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {state === "scanning" && (
        <div className="shrink-0 border-t border-slate-800/80 bg-[#000814] px-4 py-4 text-center text-sm text-slate-300">
          {message}
        </div>
      )}
    </div>
  );
}
