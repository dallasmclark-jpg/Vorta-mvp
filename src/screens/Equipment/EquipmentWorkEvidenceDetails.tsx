import {
  ClipboardCheck,
  Database,
  PackageCheck,
} from "lucide-react";
import type { LiveEquipmentHistoryItem } from "./equipmentPilotEvidence";
import {
  formatDate,
  formatDateTime,
  formatQuantity,
} from "./EquipmentPilotEvidenceShared";

export function WorkEvidenceDetails({ item }: { item: LiveEquipmentHistoryItem }): JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <EvidenceList
        title="Confirmations"
        icon={ClipboardCheck}
        empty="No confirmation text recorded"
        rows={item.confirmations.map((confirmation) => ({
          key: confirmation.id,
          title: confirmation.confirmationNumber ?? "Confirmation",
          detail: confirmation.text ?? "No confirmation text",
          meta: `${confirmation.confirmedBy ?? "Unknown engineer"} · ${formatDateTime(confirmation.confirmedAt ?? confirmation.postingDate)}`,
        }))}
      />
      <EvidenceList
        title="Reservations"
        icon={PackageCheck}
        empty="No material reservations recorded"
        rows={item.reservations.map((reservation) => ({
          key: reservation.id,
          title: reservation.materialNumber,
          detail: `${formatQuantity(reservation.reservedQuantity, reservation.baseUnit)} reserved of ${formatQuantity(reservation.requiredQuantity, reservation.baseUnit)}`,
          meta: `${reservation.reservationNumber ?? "No reservation number"} · ${reservation.status}`,
        }))}
      />
      <EvidenceList
        title="Goods movements"
        icon={Database}
        empty="No goods movements recorded"
        rows={item.goodsMovements.map((movement) => ({
          key: movement.id,
          title: movement.materialNumber ?? "Material movement",
          detail: `${formatQuantity(movement.quantity, movement.baseUnit)} · movement ${movement.movementType ?? "—"}`,
          meta: `${movement.materialDocumentNumber ?? "No material document"} · ${formatDate(movement.postingDate)}`,
        }))}
      />
    </div>
  );
}

function EvidenceList({
  title,
  icon: Icon,
  empty,
  rows,
}: {
  title: string;
  icon: typeof Database;
  empty: string;
  rows: Array<{ key: string; title: string; detail: string; meta: string }>;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-300" />
        <h3 className="text-xs font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="mt-3 space-y-2">
        {rows.length ? rows.map((row) => (
          <div key={row.key} className="rounded-md border border-gray-800 bg-[#10151d] p-3">
            <p className="text-xs font-semibold text-slate-200">{row.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{row.detail}</p>
            <p className="mt-1 text-[10px] text-slate-600">{row.meta}</p>
          </div>
        )) : <p className="text-xs text-slate-600">{empty}</p>}
      </div>
    </section>
  );
}
