import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Wrench, X } from "lucide-react";
import { EngineerStoresScreen } from "./EngineerCoreScreens";
import { getEquipmentList, type EquipmentListItem } from "../Equipment/equipmentService";

function setStoresSearch(value: string): void {
  const input = document.querySelector<HTMLInputElement>(
    '[data-vorta-engineer-stores="true"] input[placeholder^="Search part"]',
  );

  if (!input) return;

  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

export function EngineerStoresEquipmentFilter(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleClick = (event: MouseEvent): void => {
      const target = event.target as Element | null;
      const link = target?.closest<HTMLAnchorElement>(
        '[data-vorta-engineer-stores="true"] a[href="/engineer/equipment"]',
      );

      if (!link) return;

      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (!open || equipment.length > 0) return;

    let cancelled = false;
    setLoading(true);

    void getEquipmentList()
      .then((items) => {
        if (!cancelled) setEquipment(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, equipment.length]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return equipment;

    return equipment.filter((asset) =>
      [asset.name, asset.assetNumber, asset.area, asset.type, asset.oem]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [equipment, query]);

  const chooseEquipment = (asset: EquipmentListItem): void => {
    setStoresSearch(asset.name || asset.assetNumber);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <EngineerStoresScreen />
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1200] flex items-end bg-black/65 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Find stores inventory by equipment"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <section className="flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-700/80 bg-[#020a17] shadow-2xl sm:max-w-xl sm:rounded-3xl">
                <div className="flex items-center gap-3 border-b border-slate-800/80 px-4 py-4 sm:px-5">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <Wrench className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-100">Find by Equipment</h2>
                    <p className="text-xs text-slate-500">Choose an asset to show only its linked spares.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:text-white"
                    aria-label="Close equipment picker"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 sm:p-5">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search equipment, asset number or area"
                      className="min-h-12 w-full rounded-xl border border-slate-700/80 bg-[#07172b] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400/60"
                    />
                  </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-800/70">
                  {loading ? (
                    <p className="px-5 py-8 text-center text-sm text-slate-500">Loading equipment…</p>
                  ) : filtered.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-slate-500">No equipment matches this search.</p>
                  ) : (
                    <div className="divide-y divide-slate-800/60">
                      {filtered.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => chooseEquipment(asset)}
                          className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-500/[0.05] sm:px-5"
                        >
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#07172b] text-blue-400">
                            <Wrench className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-100">{asset.name}</p>
                            <p className="truncate text-xs text-slate-500">{asset.assetNumber} · {asset.area}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800/80 p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => {
                      setStoresSearch("");
                      setOpen(false);
                      setQuery("");
                    }}
                    className="min-h-11 w-full rounded-xl border border-slate-700/80 bg-[#07172b] px-4 text-sm font-medium text-slate-300 hover:border-blue-400/40 hover:text-white"
                  >
                    Show all inventory
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
