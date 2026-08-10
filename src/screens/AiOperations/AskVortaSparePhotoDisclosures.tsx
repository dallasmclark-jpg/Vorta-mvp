import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Target } from "lucide-react";
import { useAuth, type PilotRole } from "../../lib/auth";
import { InventoryItemDisclosure } from "../StoresInventory/StoresInventorySection";
import {
  loadStoresInventorySnapshot,
  type StoresInventoryItem,
} from "../StoresInventory/storesInventoryService";
import type { AskVortaWorkspaceAnswer } from "./AskVortaWorkspaceBase";

type InventorySnapshotResult = Awaited<ReturnType<typeof loadStoresInventorySnapshot>>;
type LoadState = "idle" | "loading" | "ready" | "unavailable";

type SparePhotoWorkspaceAnswer = AskVortaWorkspaceAnswer & {
  intentLabel?: string;
  decisionSummary?: Array<{
    label: string;
    value: string;
  }>;
};

interface ParsedSpareMatch {
  rank: number;
  confidence: number | null;
  stockNumber: string;
  label: string;
  value: string;
  expectedName: string;
}

interface ResolvedSpareMatch {
  match: ParsedSpareMatch;
  item: StoresInventoryItem | null;
  reason: "resolved" | "missing" | "ambiguous";
}

const inFlightInventoryLoads = new Map<string, Promise<InventorySnapshotResult>>();

function loadSharedInventorySnapshot(siteId: string): Promise<InventorySnapshotResult> {
  const existing = inFlightInventoryLoads.get(siteId);
  if (existing) return existing;

  const request = loadStoresInventorySnapshot(siteId).finally(() => {
    inFlightInventoryLoads.delete(siteId);
  });
  inFlightInventoryLoads.set(siteId, request);
  return request;
}

function normalise(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z0-9]+/g, "");
}

export function parseAskVortaSparePhotoMatch(
  item: { label: string; value: string },
  index: number,
): ParsedSpareMatch {
  const label = item.label.trim();
  const exact = label.match(/^\s*(\d+)\.\s*(\d{1,3})%\s*·\s*(.+?)\s*$/);
  const fallbackStock = label.includes("·")
    ? label.split("·").at(-1)?.trim() ?? ""
    : "";
  const expectedName = item.value.split("·", 1)[0]?.trim() ?? "";

  return {
    rank: exact ? Number(exact[1]) : index + 1,
    confidence: exact ? Math.max(0, Math.min(100, Number(exact[2]))) : null,
    stockNumber: exact?.[3]?.trim() || fallbackStock,
    label,
    value: item.value.trim(),
    expectedName,
  };
}

function getSparePhotoMatches(answer: AskVortaWorkspaceAnswer): ParsedSpareMatch[] {
  const typedAnswer = answer as SparePhotoWorkspaceAnswer;
  return (typedAnswer.decisionSummary ?? [])
    .map(parseAskVortaSparePhotoMatch)
    .filter((match) => Boolean(match.stockNumber))
    .sort((first, second) => first.rank - second.rank);
}

export function isAskVortaSparePhotoAnswer(
  answer: AskVortaWorkspaceAnswer,
): boolean {
  const typedAnswer = answer as SparePhotoWorkspaceAnswer;
  return (
    typedAnswer.intentLabel === "Spare photo identification" &&
    getSparePhotoMatches(answer).length > 0
  );
}

export function resolveAskVortaSparePhotoMatch(
  match: ParsedSpareMatch,
  items: StoresInventoryItem[],
): ResolvedSpareMatch {
  const stockNumber = normalise(match.stockNumber);
  if (!stockNumber) {
    return { match, item: null, reason: "missing" };
  }

  const candidates = items.filter(
    (item) => normalise(item.partNumber) === stockNumber,
  );
  if (candidates.length === 1) {
    return { match, item: candidates[0], reason: "resolved" };
  }
  if (candidates.length === 0) {
    return { match, item: null, reason: "missing" };
  }

  const expectedName = normalise(match.expectedName);
  if (expectedName) {
    const exactNameMatches = candidates.filter(
      (item) => normalise(item.partName) === expectedName,
    );
    if (exactNameMatches.length === 1) {
      return { match, item: exactNameMatches[0], reason: "resolved" };
    }

    const compatibleNameMatches = candidates.filter((item) => {
      const candidateName = normalise(item.partName);
      return (
        candidateName.includes(expectedName) ||
        expectedName.includes(candidateName)
      );
    });
    if (compatibleNameMatches.length === 1) {
      return { match, item: compatibleNameMatches[0], reason: "resolved" };
    }
  }

  return { match, item: null, reason: "ambiguous" };
}

function MatchConfidence({ confidence }: { confidence: number | null }): JSX.Element | null {
  if (confidence === null) return null;
  return (
    <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-200">
      {confidence}% match
    </span>
  );
}

function PrimaryMatchConfidence({
  confidence,
}: {
  confidence: number | null;
}): JSX.Element | null {
  if (confidence === null) return null;

  const tone =
    confidence >= 90
      ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-100"
      : confidence >= 70
        ? "border-blue-500/30 bg-blue-500/[0.08] text-blue-100"
        : "border-amber-400/30 bg-amber-400/[0.08] text-amber-100";

  return (
    <span
      data-vorta-ask-vorta-primary-match-confidence="true"
      aria-label={`Primary image match score ${confidence} percent`}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${tone}`}
    >
      <Target className="h-4 w-4" aria-hidden="true" />
      <span className="text-lg font-bold leading-none">{confidence}%</span>
      <span className="text-xs font-bold uppercase">match</span>
    </span>
  );
}

function MatchFallback({ resolved }: { resolved: ResolvedSpareMatch }): JSX.Element {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100">
          {resolved.match.stockNumber || resolved.match.label}
        </p>
        <MatchConfidence confidence={resolved.match.confidence} />
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-300">{resolved.match.value}</p>
      <p className="mt-2 text-xs leading-5 text-amber-100/75">
        {resolved.reason === "ambiguous"
          ? "More than one authenticated Stores Inventory record uses this stock number, so Vorta has not opened one silently."
          : "The matched stock number could not be resolved to a current authenticated Stores Inventory record."}
      </p>
    </div>
  );
}

function ResolvedMatchDisclosure({
  resolved,
  siteId,
  role,
  initiallyOpen = false,
}: {
  resolved: ResolvedSpareMatch & { item: StoresInventoryItem };
  siteId: string;
  role: PilotRole | null | undefined;
  initiallyOpen?: boolean;
}): JSX.Element {
  const disclosureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initiallyOpen) return;
    const disclosure = disclosureRef.current?.querySelector<HTMLDetailsElement>(
      'details[data-vorta-inventory-disclosure="true"]',
    );
    if (disclosure) disclosure.open = true;
  }, [initiallyOpen, resolved.item.id]);

  return (
    <div
      ref={disclosureRef}
      data-vorta-ask-vorta-spare-match="resolved"
      className="space-y-2"
    >
      <InventoryItemDisclosure
        item={resolved.item}
        siteId={siteId}
        role={role}
      />
    </div>
  );
}

function SpareMatchLoadingRail({ stockNumber }: { stockNumber?: string }): JSX.Element {
  const steps = [
    { label: "Image", state: "complete" as const },
    { label: "Stores", state: "complete" as const },
    { label: "Match", state: "complete" as const },
    { label: "Stock record", state: "active" as const },
  ];

  return (
    <div className="space-y-2 px-1 py-1" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <ShieldCheck className="h-4 w-4 text-blue-300" aria-hidden="true" />
        Checking Vorta evidence
      </div>
      <div
        data-vorta-ask-vorta-stock-loading-rail="true"
        className="flex w-full items-center overflow-hidden"
        aria-label="Image checked, Stores checked, match found, opening stock record"
      >
        {steps.map((step, index) => (
          <Fragment key={step.label}>
            <div className="flex shrink-0 items-center gap-2">
              {step.state === "complete" ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                </span>
              ) : (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-300" aria-hidden="true" />
                </span>
              )}
              <span
                className={
                  step.state === "active"
                    ? "text-xs font-semibold text-slate-100"
                    : "text-xs font-medium text-slate-400"
                }
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className="mx-2 h-px w-6 shrink-0 bg-slate-700" aria-hidden="true" />
            ) : null}
          </Fragment>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {stockNumber
          ? `Opening the verified Stores Inventory record for ${stockNumber}…`
          : "Opening the verified Stores Inventory record…"}
      </p>
    </div>
  );
}

export function AskVortaSparePhotoDisclosures({
  answer,
}: {
  answer: AskVortaWorkspaceAnswer;
}): JSX.Element | null {
  const { siteContext } = useAuth();
  const [state, setState] = useState<LoadState>("idle");
  const [items, setItems] = useState<StoresInventoryItem[]>([]);

  const matches = useMemo(() => getSparePhotoMatches(answer), [answer]);
  const sparePhotoIdentification = isAskVortaSparePhotoAnswer(answer);

  useEffect(() => {
    if (!sparePhotoIdentification) return;
    const siteId = siteContext?.siteId;
    if (!siteId) {
      setItems([]);
      setState("unavailable");
      return;
    }

    let cancelled = false;
    setState("loading");
    void loadSharedInventorySnapshot(siteId)
      .then((result) => {
        if (cancelled) return;
        if (result.status !== "ready") {
          setItems([]);
          setState("unavailable");
          return;
        }
        setItems(result.data.items);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [siteContext?.siteId, sparePhotoIdentification]);

  const resolvedMatches = useMemo(
    () => matches.map((match) => resolveAskVortaSparePhotoMatch(match, items)),
    [items, matches],
  );

  if (!sparePhotoIdentification) return null;

  if (state === "loading" || state === "idle") {
    return (
      <div
        data-vorta-ask-vorta-spare-disclosures="true"
        data-vorta-loading="true"
      >
        <SpareMatchLoadingRail stockNumber={matches[0]?.stockNumber} />
      </div>
    );
  }

  const primary = resolvedMatches[0];
  const alternatives = resolvedMatches.slice(1);
  const siteId = siteContext?.siteId ?? "";
  const role = siteContext?.role;

  return (
    <section
      data-vorta-ask-vorta-spare-disclosures="true"
      className="space-y-4"
      aria-label="Closest stock match"
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 px-1">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Closest stock match
          </h4>
          <PrimaryMatchConfidence confidence={primary?.match.confidence ?? null} />
        </div>

        {state === "unavailable" ? (
          <>
            {primary ? (
              <MatchFallback
                resolved={{ ...primary, item: null, reason: "missing" }}
              />
            ) : null}
            <p className="px-1 text-xs leading-5 text-amber-100/75">
              Full Stores Inventory detail could not be loaded. Vorta is keeping the bounded image match and is not substituting unverified spare information.
            </p>
          </>
        ) : primary?.item ? (
          <ResolvedMatchDisclosure
            resolved={primary as ResolvedSpareMatch & { item: StoresInventoryItem }}
            siteId={siteId}
            role={role}
            initiallyOpen
          />
        ) : primary ? (
          <MatchFallback resolved={primary} />
        ) : null}
      </div>

      {alternatives.length > 0 ? (
        <div className="space-y-3" data-vorta-ask-vorta-next-spare-matches="true">
          <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Next closest matches
          </h4>
          {alternatives.map((resolved) => (
            <div
              key={`${resolved.match.rank}-${resolved.match.stockNumber}`}
              className="space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="text-xs font-semibold text-slate-500">
                  Match {resolved.match.rank}
                </span>
                <MatchConfidence confidence={resolved.match.confidence} />
              </div>
              {state === "ready" && resolved.item ? (
                <ResolvedMatchDisclosure
                  resolved={resolved as ResolvedSpareMatch & { item: StoresInventoryItem }}
                  siteId={siteId}
                  role={role}
                />
              ) : (
                <MatchFallback
                  resolved={
                    state === "unavailable"
                      ? { ...resolved, item: null, reason: "missing" }
                      : resolved
                  }
                />
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
