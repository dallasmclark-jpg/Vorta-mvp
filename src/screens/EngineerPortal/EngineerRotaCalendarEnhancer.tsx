import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  clearEngineerCalendarSaveBridge,
  getMyEngineerCalendar,
  primeEngineerCalendarSaveBridge,
  type EngineerCalendarEntry,
  type EngineerCalendarEntryType,
} from "./engineerCalendarService";

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function parseDaySheetDate(value: string): string | null {
  const match = value.trim().match(/,\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

function entryTypeLabel(value: EngineerCalendarEntryType): string {
  switch (value) {
    case "training":
      return "Training";
    case "overtime":
      return "Overtime";
    case "annual_leave":
      return "Annual leave";
    case "appointment":
      return "Appointment";
    case "shift_cover":
      return "Shift cover";
    case "development":
      return "Development";
    case "other":
      return "Other";
    default:
      return "Note";
  }
}

function findLabel(dialog: HTMLElement, labelText: string): HTMLLabelElement | null {
  return (
    Array.from(dialog.querySelectorAll<HTMLLabelElement>("label")).find((label) =>
      label.textContent?.trim().toLowerCase().startsWith(labelText.toLowerCase()),
    ) ?? null
  );
}

function setReactControlValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null,
  value: string,
): void {
  if (!element) return;
  const prototype =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
}

function ensureTypeOptions(dialog: HTMLElement): void {
  const select = findLabel(dialog, "Type")?.querySelector<HTMLSelectElement>("select");
  if (!select) return;
  const options: Array<[EngineerCalendarEntryType, string]> = [
    ["shift_cover", "Shift cover"],
    ["development", "Development"],
  ];
  options.forEach(([value, label]) => {
    if (select.querySelector(`option[value="${value}"]`)) return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}

function ensureEquipmentField(dialog: HTMLElement): HTMLInputElement | null {
  const existing = dialog.querySelector<HTMLInputElement>("[data-vorta-equipment-input='true']");
  if (existing) return existing;

  const hoursLabel = findLabel(dialog, "Hours");
  const formArea = hoursLabel?.parentElement;
  if (!hoursLabel || !formArea) return null;

  const label = document.createElement("label");
  label.dataset.vortaEquipmentField = "true";
  label.className = "block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500";
  label.append("Equipment ");

  const optional = document.createElement("span");
  optional.className = "text-slate-600";
  optional.textContent = "optional";
  label.appendChild(optional);

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 160;
  input.placeholder = "e.g. Bosch VF-02";
  input.dataset.vortaEquipmentInput = "true";
  input.className =
    "mt-1.5 h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-sm font-medium normal-case tracking-normal text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
  label.appendChild(input);

  formArea.insertBefore(label, hoursLabel);
  return input;
}

function addEditingNote(dialog: HTMLElement, title: string): void {
  const existing = dialog.querySelector<HTMLElement>("[data-vorta-editing-entry='true']");
  if (existing) {
    existing.textContent = `Editing · ${title}`;
    return;
  }
  const titleInput = dialog.querySelector<HTMLInputElement>('input[maxlength="160"]');
  if (!titleInput) return;
  const note = document.createElement("p");
  note.dataset.vortaEditingEntry = "true";
  note.className = "text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-400";
  note.textContent = `Editing · ${title}`;
  titleInput.parentElement?.insertBefore(note, titleInput);
}

function removeEditingNote(dialog: HTMLElement): void {
  dialog.querySelector<HTMLElement>("[data-vorta-editing-entry='true']")?.remove();
}

export function EngineerRotaCalendarEnhancer(): null {
  const { pathname } = useLocation();
  const { siteContext } = useAuth();
  const siteId = siteContext?.siteId ?? null;

  useEffect(() => {
    if (pathname !== "/engineer/rota" || !siteId) return undefined;

    let disposed = false;
    let scheduled: number | null = null;
    let lastSignature = "";
    let currentEntries: EngineerCalendarEntry[] = [];
    let currentDate: string | null = null;
    let editingEntryId: string | null = null;

    const decorateEntries = (dialog: HTMLElement): void => {
      const deleteButtons = Array.from(
        dialog.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete "]'),
      );
      const used = new Set<string>();

      deleteButtons.forEach((deleteButton) => {
        const title = (deleteButton.getAttribute("aria-label") ?? "").replace(/^Delete\s+/, "");
        const entry = currentEntries.find(
          (item) =>
            item.source !== "training_booking" &&
            item.entryDate === currentDate &&
            item.title === title &&
            !used.has(item.id),
        );
        if (!entry) return;
        used.add(entry.id);

        const card = deleteButton.parentElement?.parentElement as HTMLElement | null;
        if (!card) return;
        card.dataset.vortaCalendarEntryId = entry.id;

        const badge = card.querySelector<HTMLElement>("span");
        if (badge) badge.textContent = entryTypeLabel(entry.entryType);

        if (entry.equipmentName) {
          let equipmentMeta = card.querySelector<HTMLElement>("[data-vorta-equipment-meta='true']");
          if (!equipmentMeta) {
            const metadata = Array.from(card.querySelectorAll<HTMLElement>("div")).find((element) =>
              element.className.includes("gap-x-3"),
            );
            if (metadata) {
              equipmentMeta = document.createElement("span");
              equipmentMeta.dataset.vortaEquipmentMeta = "true";
              metadata.prepend(equipmentMeta);
            }
          }
          if (equipmentMeta) equipmentMeta.textContent = `Equipment · ${entry.equipmentName}`;
        }

        const controls = deleteButton.parentElement;
        if (!controls || controls.querySelector(`[data-vorta-edit-entry="${entry.id}"]`)) return;

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.dataset.vortaEditEntry = entry.id;
        editButton.textContent = "Edit";
        editButton.className =
          "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-800/70 px-2.5 text-[10px] font-semibold text-slate-500 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
        editButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          clearEngineerCalendarSaveBridge();
          editingEntryId = entry.id;

          const addButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find(
            (button) => button.textContent?.trim() === "Add",
          );
          const fillForm = (): void => {
            ensureTypeOptions(dialog);
            const equipmentInput = ensureEquipmentField(dialog);
            primeEngineerCalendarSaveBridge({
              entryId: entry.id,
              equipmentName: entry.equipmentName,
            });
            setReactControlValue(
              findLabel(dialog, "Type")?.querySelector<HTMLSelectElement>("select") ?? null,
              entry.entryType,
            );
            setReactControlValue(
              findLabel(dialog, "Status")?.querySelector<HTMLSelectElement>("select") ?? null,
              entry.status,
            );
            setReactControlValue(
              dialog.querySelector<HTMLInputElement>('input[maxlength="160"]'),
              entry.title,
            );
            setReactControlValue(dialog.querySelector<HTMLTextAreaElement>("textarea"), entry.notes ?? "");
            setReactControlValue(
              dialog.querySelector<HTMLInputElement>('input[type="number"]'),
              entry.hours === null ? "" : String(entry.hours),
            );
            setReactControlValue(equipmentInput, entry.equipmentName ?? "");
            addEditingNote(dialog, entry.title);
          };

          if (!dialog.querySelector<HTMLInputElement>('input[maxlength="160"]')) {
            addButton?.click();
            window.setTimeout(fillForm, 0);
          } else {
            fillForm();
          }
        });
        controls.insertBefore(editButton, deleteButton);
      });
    };

    const loadEntries = async (date: string, dialog: HTMLElement): Promise<void> => {
      try {
        const snapshot = await getMyEngineerCalendar(siteId, date, date);
        if (disposed || currentDate !== date) return;
        currentEntries = [...snapshot.entries, ...snapshot.formalTraining];
        decorateEntries(dialog);
      } catch {
        // The native calendar remains fully usable if the enhancement lookup fails.
      }
    };

    const enhance = (): void => {
      scheduled = null;
      const dialog = document.querySelector<HTMLElement>(
        '[role="dialog"][aria-labelledby="engineer-rota-day-title"]',
      );
      if (!dialog) {
        currentDate = null;
        currentEntries = [];
        editingEntryId = null;
        clearEngineerCalendarSaveBridge();
        lastSignature = "";
        return;
      }

      const heading = dialog.querySelector<HTMLElement>("#engineer-rota-day-title");
      const date = parseDaySheetDate(heading?.textContent ?? "");
      if (!date) return;
      currentDate = date;

      ensureTypeOptions(dialog);
      ensureEquipmentField(dialog);

      const addButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Add",
      );
      if (addButton && addButton.dataset.vortaCalendarBridge !== "true") {
        addButton.dataset.vortaCalendarBridge = "true";
        addButton.addEventListener("click", () => {
          editingEntryId = null;
          clearEngineerCalendarSaveBridge();
          removeEditingNote(dialog);
        }, true);
      }

      const saveButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Save to profile" || button.textContent?.trim() === "Saving…",
      );
      if (saveButton && saveButton.dataset.vortaCalendarBridge !== "true") {
        saveButton.dataset.vortaCalendarBridge = "true";
        saveButton.addEventListener("click", () => {
          const equipmentName = dialog
            .querySelector<HTMLInputElement>("[data-vorta-equipment-input='true']")
            ?.value.trim();
          primeEngineerCalendarSaveBridge({
            ...(editingEntryId ? { entryId: editingEntryId } : {}),
            equipmentName: equipmentName || null,
          });
        }, true);
      }

      const cancelButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Cancel",
      );
      if (cancelButton && cancelButton.dataset.vortaCalendarBridge !== "true") {
        cancelButton.dataset.vortaCalendarBridge = "true";
        cancelButton.addEventListener("click", () => {
          editingEntryId = null;
          clearEngineerCalendarSaveBridge();
          removeEditingNote(dialog);
        }, true);
      }

      const signature = `${date}|${Array.from(
        dialog.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete "]'),
      )
        .map((button) => button.getAttribute("aria-label"))
        .join("|")}`;

      if (signature !== lastSignature) {
        lastSignature = signature;
        void loadEntries(date, dialog);
      } else {
        decorateEntries(dialog);
      }
    };

    const scheduleEnhance = (): void => {
      if (scheduled !== null) window.clearTimeout(scheduled);
      scheduled = window.setTimeout(enhance, 30);
    };

    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleEnhance();

    return () => {
      disposed = true;
      observer.disconnect();
      if (scheduled !== null) window.clearTimeout(scheduled);
      clearEngineerCalendarSaveBridge();
    };
  }, [pathname, siteId]);

  return null;
}
