import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const VORTA_SELECT_STYLES = atob(
  "QG1lZGlhIChtYXgtd2lkdGg6IDc2N3B4KSB7CiAgW2RhdGEtdm9ydGEtZW5naW5lZXItc2hlbGw9InRydWUiXSBzZWxlY3QgewogICAgLXdlYmtpdC1hcHBlYXJhbmNlOiBub25lICFpbXBvcnRhbnQ7CiAgICBhcHBlYXJhbmNlOiBub25lICFpbXBvcnRhbnQ7CiAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoImRhdGE6aW1hZ2Uvc3ZnK3htbCwlM0NzdmcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB3aWR0aD0nMjAnIGhlaWdodD0nMjAnIHZpZXdCb3g9JzAgMCAyNCAyNCcgZmlsbD0nbm9uZScgc3Ryb2tlPSclMjM5NGEzYjgnIHN0cm9rZS13aWR0aD0nMS43JyBzdHJva2UtbGluZWNhcD0ncm91bmQnIHN0cm9rZS1saW5lam9pbj0ncm91bmQnJTNFJTNDcGF0aCBkPSdtNiA5IDYgNiA2LTYnLyUzRSUzQy9zdmclM0UiKSAhaW1wb3J0YW50OwogICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdCAhaW1wb3J0YW50OwogICAgYmFja2dyb3VuZC1wb3NpdGlvbjogcmlnaHQgMC44cmVtIGNlbnRlciAhaW1wb3J0YW50OwogICAgYmFja2dyb3VuZC1zaXplOiAxcmVtIDFyZW0gIWltcG9ydGFudDsKICAgIHBhZGRpbmctcmlnaHQ6IDIuNXJlbSAhaW1wb3J0YW50OwogICAgY29sb3Itc2NoZW1lOiBkYXJrOwogIH0KfQoKLnZvcnRhLXNlbGVjdC1vdmVybGF5IHsKICBwb3NpdGlvbjogZml4ZWQ7CiAgaW5zZXQ6IDA7CiAgei1pbmRleDogMjYwOwogIGRpc3BsYXk6IGZsZXg7CiAgYWxpZ24taXRlbXM6IGZsZXgtZW5kOwogIGp1c3RpZnktY29udGVudDogY2VudGVyOwogIHBhZGRpbmc6IDRyZW0gMC43NXJlbSBtYXgoMC43NXJlbSwgZW52KHNhZmUtYXJlYS1pbnNldC1ib3R0b20pKTsKICBiYWNrZ3JvdW5kOiByZ2JhKDAsIDAsIDAsIDAuNzIpOwogIGJhY2tkcm9wLWZpbHRlcjogYmx1cigzcHgpOwp9Cgoudm9ydGEtc2VsZWN0LXNoZWV0IHsKICBkaXNwbGF5OiBmbGV4OwogIHdpZHRoOiAxMDAlOwogIG1heC13aWR0aDogMjhyZW07CiAgbWF4LWhlaWdodDogNzJkdmg7CiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsKICBvdmVyZmxvdzogaGlkZGVuOwogIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoNTEsIDY1LCA4NSwgMC44KTsKICBib3JkZXItcmFkaXVzOiAxLjQ1cmVtOwogIGJhY2tncm91bmQ6ICMwNzExMWY7CiAgYm94LXNoYWRvdzogMCAyMnB4IDcwcHggcmdiYSgwLCAwLCAwLCAwLjQ4KTsKfQoKLnZvcnRhLXNlbGVjdC1oZWFkZXIgewogIGRpc3BsYXk6IGZsZXg7CiAgYWxpZ24taXRlbXM6IGNlbnRlcjsKICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47CiAgZ2FwOiAxcmVtOwogIHBhZGRpbmc6IDAuODc1cmVtIDFyZW07CiAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMzAsIDQxLCA1OSwgMC44NSk7Cn0KCi52b3J0YS1zZWxlY3QtaGVhZGluZyB7IG1pbi13aWR0aDogMDsgfQoudm9ydGEtc2VsZWN0LWtpY2tlciB7CiAgbWFyZ2luOiAwOwogIGNvbG9yOiAjNjBhNWZhOwogIGZvbnQtc2l6ZTogOXB4OwogIGZvbnQtd2VpZ2h0OiA2MDA7CiAgbGV0dGVyLXNwYWNpbmc6IDAuMThlbTsKICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlOwp9Ci52b3J0YS1zZWxlY3QtdGl0bGUgewogIG1hcmdpbjogMC4yNXJlbSAwIDA7CiAgb3ZlcmZsb3c6IGhpZGRlbjsKICBjb2xvcjogI2YxZjVmOTsKICBmb250LXNpemU6IDAuODc1cmVtOwogIGZvbnQtd2VpZ2h0OiA2MDA7CiAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7CiAgd2hpdGUtc3BhY2U6IG5vd3JhcDsKfQoKLnZvcnRhLXNlbGVjdC1jbG9zZSB7CiAgZGlzcGxheTogaW5saW5lLWZsZXg7CiAgd2lkdGg6IDIuNXJlbTsKICBoZWlnaHQ6IDIuNXJlbTsKICBmbGV4OiAwIDAgMi41cmVtOwogIGFsaWduLWl0ZW1zOiBjZW50ZXI7CiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7CiAgYm9yZGVyOiAxcHggc29saWQgcmdiYSg1MSwgNjUsIDg1LCAwLjgpOwogIGJvcmRlci1yYWRpdXM6IDAuNzVyZW07CiAgYmFja2dyb3VuZDogIzAzMGMxZDsKICBjb2xvcjogIzk0YTNiODsKfQoudm9ydGEtc2VsZWN0LWNsb3NlOmZvY3VzLXZpc2libGUsCi52b3J0YS1zZWxlY3Qtb3B0aW9uOmZvY3VzLXZpc2libGUgewogIG91dGxpbmU6IDJweCBzb2xpZCAjNjBhNWZhOwogIG91dGxpbmUtb2Zmc2V0OiAycHg7Cn0KLnZvcnRhLXNlbGVjdC1jbG9zZSBzdmcgeyB3aWR0aDogMXJlbTsgaGVpZ2h0OiAxcmVtOyB9Cgoudm9ydGEtc2VsZWN0LW9wdGlvbnMgewogIG92ZXJmbG93LXk6IGF1dG87CiAgcGFkZGluZzogMC42MjVyZW07CiAgb3ZlcnNjcm9sbC1iZWhhdmlvcjogY29udGFpbjsKfQoudm9ydGEtc2VsZWN0LWdyb3VwIHsKICBtYXJnaW46IDA7CiAgcGFkZGluZzogMC43NXJlbSAwLjc1cmVtIDAuMjVyZW07CiAgY29sb3I6ICM0NzU1Njk7CiAgZm9udC1zaXplOiA5cHg7CiAgZm9udC13ZWlnaHQ6IDYwMDsKICBsZXR0ZXItc3BhY2luZzogMC4xNGVtOwogIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7Cn0KLnZvcnRhLXNlbGVjdC1vcHRpb24gewogIGRpc3BsYXk6IGZsZXg7CiAgd2lkdGg6IDEwMCU7CiAgbWluLWhlaWdodDogMy4zNXJlbTsKICBhbGlnbi1pdGVtczogY2VudGVyOwogIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsKICBnYXA6IDAuNzVyZW07CiAgbWFyZ2luLWJvdHRvbTogMC4yNXJlbTsKICBwYWRkaW5nOiAwLjYyNXJlbSAwLjg3NXJlbTsKICBib3JkZXI6IDFweCBzb2xpZCB0cmFuc3BhcmVudDsKICBib3JkZXItcmFkaXVzOiAwLjc1cmVtOwogIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50OwogIGNvbG9yOiAjZTJlOGYwOwogIGZvbnQ6IGluaGVyaXQ7CiAgZm9udC1zaXplOiAwLjg3NXJlbTsKICBmb250LXdlaWdodDogNTAwOwogIHRleHQtYWxpZ246IGxlZnQ7Cn0KLnZvcnRhLXNlbGVjdC1vcHRpb25bZGF0YS1zZWxlY3RlZD0idHJ1ZSJdIHsKICBib3JkZXItY29sb3I6IHJnYmEoOTYsIDE2NSwgMjUwLCAwLjQ1KTsKICBiYWNrZ3JvdW5kOiByZ2JhKDU5LCAxMzAsIDI0NiwgMC4xMCk7CiAgY29sb3I6ICNkYmVhZmU7Cn0KLnZvcnRhLXNlbGVjdC1vcHRpb246ZGlzYWJsZWQgeyBvcGFjaXR5OiAwLjQ7IH0KLnZvcnRhLXNlbGVjdC1vcHRpb24tbGFiZWwgewogIG1pbi13aWR0aDogMDsKICBmbGV4OiAxIDEgYXV0bzsKICBsaW5lLWhlaWdodDogMS4yNXJlbTsKfQoudm9ydGEtc2VsZWN0LXJhZGlvIHsKICBkaXNwbGF5OiBncmlkOwogIHdpZHRoOiAxLjI1cmVtOwogIGhlaWdodDogMS4yNXJlbTsKICBmbGV4OiAwIDAgMS4yNXJlbTsKICBwbGFjZS1pdGVtczogY2VudGVyOwogIGJvcmRlcjogMXB4IHNvbGlkICM2NDc0OGI7CiAgYm9yZGVyLXJhZGl1czogOTk5OXB4Owp9Ci52b3J0YS1zZWxlY3Qtb3B0aW9uW2RhdGEtc2VsZWN0ZWQ9InRydWUiXSAudm9ydGEtc2VsZWN0LXJhZGlvIHsKICBib3JkZXItY29sb3I6ICM5M2M1ZmQ7CiAgYmFja2dyb3VuZDogcmdiYSg1OSwgMTMwLCAyNDYsIDAuMTApOwp9Ci52b3J0YS1zZWxlY3QtcmFkaW8tZG90IHsKICB3aWR0aDogMC42MjVyZW07CiAgaGVpZ2h0OiAwLjYyNXJlbTsKICBib3JkZXItcmFkaXVzOiA5OTk5cHg7CiAgYmFja2dyb3VuZDogIzkzYzVmZDsKfQ==",
);

interface SelectOptionSnapshot {
  value: string;
  label: string;
  disabled: boolean;
  group: string | null;
}

interface ActiveSelectSnapshot {
  element: HTMLSelectElement;
  label: string;
  value: string;
  options: SelectOptionSnapshot[];
}

function isMobileEngineerSelect(select: HTMLSelectElement | null): select is HTMLSelectElement {
  if (!select || select.disabled) return false;
  if (!select.closest('[data-vorta-engineer-shell="true"]')) return false;
  return window.matchMedia("(max-width: 767px)").matches;
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

  const label = select.closest("label");
  if (label) {
    const clone = label.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("select, input, textarea, button, option, optgroup")
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

  return "Select option";
}

function snapshotSelect(select: HTMLSelectElement): ActiveSelectSnapshot {
  return {
    element: select,
    label: resolveSelectLabel(select),
    value: select.value,
    options: Array.from(select.options)
      .filter((option) => !option.hidden)
      .map((option) => ({
        value: option.value,
        label: option.label || option.textContent || option.value,
        disabled: option.disabled,
        group:
          option.parentElement instanceof HTMLOptGroupElement
            ? option.parentElement.label || null
            : null,
      })),
  };
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export function EngineerVortaSelectBridge(): JSX.Element {
  const [active, setActive] = useState<ActiveSelectSnapshot | null>(null);

  useEffect(() => {
    const openFromEvent = (event: Event): void => {
      const target = event.target as Element | null;
      const select = target?.closest?.("select") as HTMLSelectElement | null;
      if (!isMobileEngineerSelect(select)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setActive(snapshotSelect(select));
    };

    const suppressNativeClick = (event: Event): void => {
      const target = event.target as Element | null;
      const select = target?.closest?.("select") as HTMLSelectElement | null;
      if (!isMobileEngineerSelect(select)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    document.addEventListener("pointerdown", openFromEvent, true);
    document.addEventListener("click", suppressNativeClick, true);
    return () => {
      document.removeEventListener("pointerdown", openFromEvent, true);
      document.removeEventListener("click", suppressNativeClick, true);
    };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [active]);

  const choose = (option: SelectOptionSnapshot): void => {
    if (!active || option.disabled) return;
    const select = active.element;
    setSelectValue(select, option.value);
    setActive(null);
    window.setTimeout(() => {
      if (select.isConnected) select.focus({ preventScroll: true });
    }, 0);
  };

  return (
    <>
      <style>{VORTA_SELECT_STYLES}</style>

      {active && typeof document !== "undefined"
        ? createPortal(
            <div
              className="vorta-select-overlay"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setActive(null);
              }}
            >
              <section
                role="listbox"
                aria-label={active.label}
                className="vorta-select-sheet"
              >
                <div className="vorta-select-header">
                  <div className="vorta-select-heading">
                    <p className="vorta-select-kicker">Vorta</p>
                    <h2 className="vorta-select-title">{active.label}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    aria-label="Close options"
                    className="vorta-select-close"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>

                <div className="vorta-select-options">
                  {active.options.map((option, index) => {
                    const selected = option.value === active.value;
                    const previousGroup = index > 0 ? active.options[index - 1]?.group ?? null : null;
                    const showGroup = Boolean(option.group && option.group !== previousGroup);
                    return (
                      <div key={`${option.value}-${index}`}>
                        {showGroup ? (
                          <p className="vorta-select-group">{option.group}</p>
                        ) : null}
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          data-selected={selected ? "true" : "false"}
                          disabled={option.disabled}
                          onClick={() => choose(option)}
                          className="vorta-select-option"
                        >
                          <span className="vorta-select-option-label">{option.label}</span>
                          <span aria-hidden="true" className="vorta-select-radio">
                            {selected ? <i className="vorta-select-radio-dot" /> : null}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
