import { useEffect, useMemo, useState } from "react";
import { Database } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { InventoryItemDisclosure } from "../StoresInventory/StoresInventorySection";
import {
  loadStoresInventorySnapshot,
  type StoresInventoryItem,
} from "../StoresInventory/storesInventoryService";

type RegisterState = "loading" | "ready" | "empty" | "error";
type InventorySnapshotResult = Awaited<ReturnType<typeof loadStoresInventorySnapshot>>;

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

interface EquipmentSparesDisclosureRegisterProps {
  equipmentId: string;
  visiblePartNumbers: string[];
}

export function EquipmentSparesDisclosureRegister({
  equipmentId,
  visiblePartNumbers,
}: EquipmentSparesDisclosureRegisterProps): JSX.Element {
  const { siteContext } = useAuth();
  const [state, setState] = useState<RegisterState>("loading");
  const [items, setItems] = useState<StoresInventoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const siteId = siteContext?.siteId;

    if (!siteId) {
      setItems([]);
      setState("error");
      return () => {
        cancelled = true;
      };
    }

    setState("loading");
    void loadSharedInventorySnapshot(siteId)
      .then((result) => {
        if (cancelled) return;
        if (result.status !== "ready") {
          setItems([]);
          setState(result.status === "empty" ? "empty" : "error");
          return;
        }

        const equipmentItems = result.data.items.filter(
          (item) => item.equipmentId === equipmentId,
        );
        setItems(equipmentItems);
        setState(equipmentItems.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [equipmentId, siteContext?.siteId]);

  const visibleItems = useMemo(() => {
    const byPartNumber = new Map(items.map((item) => [item.partNumber, item]));
    return visiblePartNumbers
      .map((partNumber) => byPartNumber.get(partNumber))
      .filter((item): item is StoresInventoryItem => Boolean(item));
  }, [items, visiblePartNumbers]);

  if (state === "loading") {
    return (
      <div className="mt-4 rounded-xl border border-gray-800 bg-[#0d1117] px-5 py-8 text-center text-xs text-slate-500">
        Loading linked spare details…
      </div>
    );
  }

  if (visiblePartNumbers.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-gray-700 bg-[#0d1117] px-5 py-10 text-center">
        <Database className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
        <p className="mt-3 text-xs text-slate-500">No linked parts match these filters.</p>
      </div>
    );
  }

  if (state === "error" || visibleItems.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-100" role="status">
        Verified Stores Inventory detail is unavailable for these linked parts. Vorta is not substituting image or OEM evidence.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3" data-vorta-equipment-spares-disclosures="true">
      {visibleItems.map((item) => (
        <InventoryItemDisclosure
          key={item.id}
          item={item}
          siteId={siteContext?.siteId ?? ""}
          role={siteContext?.role}
        />
      ))}
    </div>
  );
}
