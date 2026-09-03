import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

type EquipmentImageRow = {
  id: string;
  equipment_code: string | null;
  name: string | null;
  image_url: string | null;
  image_alt_text: string | null;
  image_verification_status: string | null;
};

type ComponentImageRow = {
  equipment_id: string;
  component_code: string | null;
  component_name: string | null;
  image_url: string | null;
  image_alt_text: string | null;
  image_verification_status: string | null;
};

const DECORATED = "vortaDbImage";

function normalise(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function usableImage(row: { image_url: string | null; image_verification_status: string | null }): boolean {
  if (!row.image_url) return false;
  const status = normalise(row.image_verification_status);
  return !status || status === "verified" || status === "approved" || status === "current";
}

function equipmentFromText(rows: EquipmentImageRow[], text: string): EquipmentImageRow | undefined {
  const haystack = ` ${normalise(text)} `;
  return rows.find((row) => {
    if (!usableImage(row)) return false;
    const code = normalise(row.equipment_code);
    const name = normalise(row.name);
    return (code.length >= 3 && haystack.includes(` ${code} `)) || (name.length >= 5 && haystack.includes(name));
  });
}

function setThumbnail(target: HTMLElement, imageUrl: string, alt: string, mode: "equipment" | "part"): void {
  if (target.dataset[DECORATED] === imageUrl) return;

  target.dataset[DECORATED] = imageUrl;
  target.style.backgroundImage = `url("${imageUrl.replace(/"/g, "%22")}")`;
  target.style.backgroundPosition = "center";
  target.style.backgroundRepeat = "no-repeat";
  target.style.backgroundSize = mode === "part" ? "contain" : "cover";
  target.style.width = "3.5rem";
  target.style.height = "3rem";
  target.style.minWidth = "3.5rem";
  target.style.borderRadius = "0.65rem";
  target.style.overflow = "hidden";
  target.style.boxShadow = "inset 0 0 0 1px rgba(96,165,250,0.18)";
  target.setAttribute("role", "img");
  target.setAttribute("aria-label", alt);

  target.querySelectorAll<HTMLElement>("svg").forEach((icon) => {
    icon.style.opacity = "0";
  });
}

function setWorkCardImage(target: HTMLElement, imageUrl: string): void {
  if (target.dataset[DECORATED] === imageUrl) return;

  target.dataset[DECORATED] = imageUrl;
  const escaped = imageUrl.replace(/"/g, "%22");
  target.style.backgroundImage = `linear-gradient(90deg, rgba(3,12,29,1) 0%, rgba(3,12,29,0.99) 48%, rgba(3,12,29,0.86) 70%, rgba(3,12,29,0.38) 100%), url("${escaped}")`;
  target.style.backgroundPosition = "center, right center";
  target.style.backgroundRepeat = "no-repeat, no-repeat";
  target.style.backgroundSize = "100% 100%, 44% 100%";
}

function findIconTarget(anchor: HTMLAnchorElement): HTMLElement | null {
  const directChildren = Array.from(anchor.children) as HTMLElement[];
  const directIcon = directChildren.find((child) => child.tagName === "SPAN" && child.querySelector("svg"));
  if (directIcon) return directIcon;

  return anchor.querySelector<HTMLElement>("span:has(svg)");
}

function decorateEngineerImages(equipment: EquipmentImageRow[], components: ComponentImageRow[]): void {
  const equipmentWithImages = equipment.filter(usableImage);
  const componentWithImages = components.filter(usableImage);
  const equipmentById = new Map(equipmentWithImages.map((row) => [row.id, row]));
  const componentByKey = new Map(
    componentWithImages.map((row) => [`${row.equipment_id}:${normalise(row.component_code)}`, row]),
  );

  document.querySelectorAll<HTMLAnchorElement>('[data-vorta-page-content="true"] a[href*="/engineer/equipment/"]').forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    const match = href.match(/\/engineer\/equipment\/([^/?#]+)/);
    const id = match ? decodeURIComponent(match[1]) : "";
    const row = equipmentById.get(id) ?? equipmentFromText(equipmentWithImages, anchor.textContent ?? "");
    if (!row?.image_url) return;

    const target = findIconTarget(anchor);
    if (!target) return;
    setThumbnail(target, row.image_url, row.image_alt_text || row.name || "Equipment image", "equipment");
  });

  document.querySelectorAll<HTMLAnchorElement>('[data-vorta-page-content="true"] a[href*="/engineer/stores/"]').forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    let url: URL;
    try {
      url = new URL(href, window.location.origin);
    } catch {
      return;
    }

    const match = url.pathname.match(/\/engineer\/stores\/([^/?#]+)/);
    if (!match) return;
    const partNumber = normalise(decodeURIComponent(match[1]));
    const equipmentId = url.searchParams.get("equipment") ?? "";
    const row = componentByKey.get(`${equipmentId}:${partNumber}`)
      ?? componentWithImages.find((item) => normalise(item.component_code) === partNumber);
    if (!row?.image_url) return;

    const target = findIconTarget(anchor);
    if (!target) return;
    setThumbnail(target, row.image_url, row.image_alt_text || row.component_name || "Spare part image", "part");
  });

  document.querySelectorAll<HTMLElement>('[data-vorta-engineer-home="true"] a[href^="/engineer/work/"], [data-vorta-engineer-my-work="true"] article').forEach((card) => {
    const row = equipmentFromText(equipmentWithImages, card.textContent ?? "");
    if (row?.image_url) setWorkCardImage(card, row.image_url);
  });
}

export function EngineerDatabaseImages(): null {
  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let scheduled = false;
    let equipment: EquipmentImageRow[] = [];
    let components: ComponentImageRow[] = [];

    const decorate = (): void => {
      if (disposed || scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        if (!disposed) decorateEngineerImages(equipment, components);
      });
    };

    void Promise.all([
      supabase
        .from("equipment_assets")
        .select("id, equipment_code, name, image_url, image_alt_text, image_verification_status")
        .not("image_url", "is", null),
      supabase
        .from("equipment_components")
        .select("equipment_id, component_code, component_name, image_url, image_alt_text, image_verification_status")
        .not("image_url", "is", null),
    ]).then(([equipmentResult, componentResult]) => {
      if (disposed) return;
      equipment = (equipmentResult.data ?? []) as EquipmentImageRow[];
      components = (componentResult.data ?? []) as ComponentImageRow[];
      decorate();

      observer = new MutationObserver(decorate);
      observer.observe(document.body, { childList: true, subtree: true });
    }).catch((error) => {
      console.warn("Engineer database image load failed:", error);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
