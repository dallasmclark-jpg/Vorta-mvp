import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VortaSelect, type VortaSelectOption } from "../../components/VortaSelect";

function associatedLabel(select: HTMLSelectElement): HTMLLabelElement | null {
  const wrappingLabel = select.closest("label");
  if (wrappingLabel instanceof HTMLLabelElement) return wrappingLabel;
  const previous = select.previousElementSibling;
  return previous instanceof HTMLLabelElement ? previous : null;
}

interface VortaSelectBinding {
  select: HTMLSelectElement;
  host: HTMLDivElement;
  hiddenElement: HTMLElement;
  originalDisplay: string;
  label: string;
}

function inferredSelectLabel(select: HTMLSelectElement): string | null {
  const labels = Array.from(select.options)
    .map((option) => (option.label || option.textContent || option.value).trim().toLowerCase())
    .filter(Boolean);
  const values = new Set(
    Array.from(select.options)
      .map((option) => option.value.trim().toLowerCase())
      .filter(Boolean),
  );

  if (["all", "high", "medium", "low"].every((value) => labels.includes(value))) {
    return "Priority";
  }
  if (["planned", "completed", "cancelled"].every((value) => values.has(value))) {
    return "Status";
  }
  if (["note", "training", "overtime"].every((value) => values.has(value))) {
    return "Type";
  }
  return null;
}

function resolveSelectLabel(select: HTMLSelectElement): string {
  const ariaLabel = select.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = select.getAttribute("aria-labelledby")?.trim();
  if (labelledBy) {
    const labelledText = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (labelledText) return labelledText;
  }

  const label = associatedLabel(select);
  if (label) {
    const clone = label.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("select, input, textarea, button, option, optgroup, svg")
      .forEach((node) => node.remove());
    const text = clone.textContent?.replace(/\s+/g, " ").trim();
    if (text) return text;
  }

  const name = select.getAttribute("name")?.trim();
  if (name) {
    return name
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  return inferredSelectLabel(select) ?? "Select option";
}

function selectOptions(select: HTMLSelectElement): VortaSelectOption<string>[] {
  return Array.from(select.options)
    .filter((option) => !option.hidden && !option.disabled)
    .map((option) => ({
      value: option.value,
      label: option.label || option.textContent || option.value,
    }));
}

function setNativeSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function layoutClassesFor(select: HTMLSelectElement): string {
  const label = associatedLabel(select);
  const source = label?.className || select.className || "";
  const tokens = source.split(/\s+/).filter(Boolean);
  const layoutTokens = tokens.filter((token) =>
    /^(?:sm:|md:|lg:|xl:|2xl:)?(?:w-|min-w-|max-w-|basis-|grow|shrink|relative$)/.test(token),
  );
  return ["min-w-0", "w-full", ...layoutTokens].join(" ");
}

function isEngineerSelect(select: HTMLSelectElement): boolean {
  return Boolean(
    select.closest('[data-vorta-engineer-shell="true"]')
    && !select.closest('[data-vorta-select="true"]'),
  );
}

export function EngineerVortaSelectBridge(): JSX.Element {
  const bindingsRef = useRef<Map<HTMLSelectElement, VortaSelectBinding>>(new Map());
  const [, refresh] = useState(0);

  useEffect(() => {
    const scheduleRefresh = (): void => refresh((value) => value + 1);

    const register = (select: HTMLSelectElement): void => {
      if (!isEngineerSelect(select) || bindingsRef.current.has(select)) return;

      const label = associatedLabel(select);
      const hiddenElement = label ?? select;
      const parent = hiddenElement.parentNode;
      if (!parent) return;

      const host = document.createElement("div");
      host.dataset.vortaSelectStandardHost = "true";
      host.className = layoutClassesFor(select);
      parent.insertBefore(host, hiddenElement);

      const originalDisplay = hiddenElement.style.display;
      hiddenElement.style.display = "none";
      select.dataset.vortaSelectStandardised = "true";

      const binding: VortaSelectBinding = {
        select,
        host,
        hiddenElement,
        originalDisplay,
        label: resolveSelectLabel(select),
      };
      bindingsRef.current.set(select, binding);

      select.addEventListener("input", scheduleRefresh);
      select.addEventListener("change", scheduleRefresh);
      scheduleRefresh();
    };

    const scan = (): void => {
      document
        .querySelectorAll<HTMLSelectElement>('[data-vorta-engineer-shell="true"] select')
        .forEach(register);

      for (const [select, binding] of bindingsRef.current) {
        if (select.isConnected && binding.host.isConnected) continue;
        select.removeEventListener("input", scheduleRefresh);
        select.removeEventListener("change", scheduleRefresh);
        if (binding.hiddenElement.isConnected) {
          binding.hiddenElement.style.display = binding.originalDisplay;
        }
        delete select.dataset.vortaSelectStandardised;
        binding.host.remove();
        bindingsRef.current.delete(select);
      }
      scheduleRefresh();
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "label", "value"],
    });

    return () => {
      observer.disconnect();
      for (const binding of bindingsRef.current.values()) {
        binding.select.removeEventListener("input", scheduleRefresh);
        binding.select.removeEventListener("change", scheduleRefresh);
        binding.hiddenElement.style.display = binding.originalDisplay;
        delete binding.select.dataset.vortaSelectStandardised;
        binding.host.remove();
      }
      bindingsRef.current.clear();
    };
  }, []);

  return (
    <>
      {Array.from(bindingsRef.current.values()).map((binding, index) =>
        binding.host.isConnected
          ? createPortal(
              <VortaSelect<string>
                label={binding.label}
                value={binding.select.value}
                options={selectOptions(binding.select)}
                disabled={binding.select.disabled}
                onChange={(value) => setNativeSelectValue(binding.select, value)}
              />,
              binding.host,
              `${binding.label}-${index}`,
            )
          : null,
      )}
    </>
  );
}
