import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  maintenanceManagerEmail,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const CEREAL_SITE_ID =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000004";
const CEREAL_EMAIL = "cereal@vorta.network";
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

interface MediaRecord {
  id: string;
  site_id: string;
  image_url: string | null;
  image_source_url: string | null;
  image_verification_status: string | null;
  image_match_basis: string | null;
  label: string;
}

interface CachedMediaResponse {
  image?: {
    id?: unknown;
    entityType?: unknown;
    entityId?: unknown;
    storagePath?: unknown;
    signedUrl?: unknown;
    sourceType?: unknown;
  };
  error?: unknown;
}

interface MediaTarget {
  entityType: "equipment" | "spare";
  record: MediaRecord;
}

function authenticatedHeaders(accessToken: string): Record<string, string> {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function authenticateCerealApi(page: Page): Promise<string> {
  const password = process.env.VORTA_E2E_PASSWORD ?? "";
  expect(password, "VORTA_E2E_PASSWORD must be configured").not.toBe("");

  const response = await page.request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: {
        email: CEREAL_EMAIL,
        password,
      },
      timeout: 30_000,
    },
  );
  const raw = await response.text();
  expect(response.ok(), `Cereal Supabase Auth failed: ${raw}`).toBe(true);

  const payload = JSON.parse(raw) as { access_token?: unknown };
  expect(
    typeof payload.access_token,
    "Cereal Supabase Auth returned no access token",
  ).toBe("string");
  return String(payload.access_token);
}

async function loadVisibleMediaRecords(
  page: Page,
  accessToken: string,
  entityType: "equipment" | "spare",
): Promise<MediaRecord[]> {
  const table = entityType === "equipment" ? "equipment_assets" : "equipment_components";
  const select =
    entityType === "equipment"
      ? "id,site_id,image_url,image_source_url,image_verification_status,image_match_basis,equipment_code,name"
      : "id,site_id,image_url,image_source_url,image_verification_status,image_match_basis,component_code,component_name";
  const order = entityType === "equipment" ? "equipment_code.asc" : "component_code.asc";

  const response = await page.request.get(`${supabaseUrl}/rest/v1/${table}`, {
    headers: authenticatedHeaders(accessToken),
    params: { select, order },
    timeout: 30_000,
  });
  const body = await response.text();
  expect(response.ok(), `${table} could not be read through cereal RLS: ${body}`).toBe(true);

  const rows = JSON.parse(body) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    site_id: String(row.site_id ?? ""),
    image_url: typeof row.image_url === "string" ? row.image_url : null,
    image_source_url:
      typeof row.image_source_url === "string" ? row.image_source_url : null,
    image_verification_status:
      typeof row.image_verification_status === "string"
        ? row.image_verification_status
        : null,
    image_match_basis:
      typeof row.image_match_basis === "string" ? row.image_match_basis : null,
    label:
      entityType === "equipment"
        ? `${String(row.equipment_code ?? "unknown")} ${String(row.name ?? "")}`.trim()
        : `${String(row.component_code ?? "unknown")} ${String(row.component_name ?? "")}`.trim(),
  }));
}

function uniqueSourceTargets(
  entityType: "equipment" | "spare",
  records: MediaRecord[],
): MediaTarget[] {
  const byUrl = new Map<string, MediaTarget>();

  for (const record of records) {
    expect(record.site_id, `${record.label} leaked from another site`).toBe(CEREAL_SITE_ID);
    expect(record.image_verification_status, `${record.label} is not verified`).toBe("verified");
    expect(record.image_match_basis, `${record.label} has no image match basis`).toBeTruthy();
    expect(record.image_url, `${record.label} has no image URL`).toBeTruthy();
    expect(record.image_source_url, `${record.label} has no source/product URL`).toBeTruthy();

    if (record.image_url && !byUrl.has(record.image_url)) {
      byUrl.set(record.image_url, { entityType, record });
    }
  }

  return [...byUrl.values()];
}

async function cacheAndDecodeSource(
  page: Page,
  accessToken: string,
  target: MediaTarget,
): Promise<void> {
  const response = await page.request.post(
    `${supabaseUrl}/functions/v1/cache-verified-media`,
    {
      headers: authenticatedHeaders(accessToken),
      data: {
        entityType: target.entityType,
        entityId: target.record.id,
      },
      timeout: 30_000,
    },
  );
  const raw = await response.text();
  expect(
    response.ok(),
    `${target.record.label} could not be cached through cache-verified-media: ${raw}`,
  ).toBe(true);

  const payload = JSON.parse(raw) as CachedMediaResponse;
  const signedUrl = payload.image?.signedUrl;
  expect(typeof signedUrl, `${target.record.label} returned no signed Vorta image URL`).toBe(
    "string",
  );
  expect(payload.image?.entityId).toBe(target.record.id);
  expect(payload.image?.entityType).toBe(target.entityType);

  const imageResponse = await page.request.get(String(signedUrl), {
    timeout: 30_000,
  });
  const contentType = (imageResponse.headers()["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const bytes = await imageResponse.body();
  expect(imageResponse.ok(), `${target.record.label} signed Vorta image did not open`).toBe(true);
  expect(
    allowedImageTypes.has(contentType),
    `${target.record.label} returned ${contentType || "no content type"}`,
  ).toBe(true);
  expect(bytes.length, `${target.record.label} returned an empty image`).toBeGreaterThan(0);

  const decoded = await page.evaluate(
    async ({ src }) =>
      await new Promise<{ ok: boolean; width: number; height: number }>((resolve) => {
        const image = new Image();
        const timer = window.setTimeout(
          () => resolve({ ok: false, width: 0, height: 0 }),
          20_000,
        );
        image.onload = () => {
          window.clearTimeout(timer);
          resolve({
            ok: image.naturalWidth > 0 && image.naturalHeight > 0,
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        };
        image.onerror = () => {
          window.clearTimeout(timer);
          resolve({ ok: false, width: 0, height: 0 });
        };
        image.src = src;
      }),
    { src: String(signedUrl) },
  );

  expect(
    decoded.ok,
    `${target.record.label} could not be decoded by Chromium from Vorta storage`,
  ).toBe(true);
  expect(decoded.width).toBeGreaterThan(0);
  expect(decoded.height).toBeGreaterThan(0);
}

async function expectRenderedImage(container: Locator, label: string): Promise<void> {
  await expect(container, `${label} image container is not visible`).toBeVisible();
  const image = container.locator("img").first();
  await expect(image, `${label} image element is not visible`).toBeVisible();
  await expect
    .poll(
      async () =>
        await image.evaluate((element) => {
          const node = element as HTMLImageElement;
          return node.complete && node.naturalWidth > 0 && node.naturalHeight > 0;
        }),
      { timeout: 30_000, message: `${label} image never completed browser decoding` },
    )
    .toBe(true);
}

test.beforeEach(async () => {
  expect(supabaseUrl, "VITE_SUPABASE_URL must be configured").not.toBe("");
  expect(supabaseAnonKey, "VITE_SUPABASE_ANON_KEY must be configured").not.toBe("");
  expect(
    maintenanceManagerEmail.toLowerCase(),
    "VOR-093 production media verification must authenticate as the cereal demo account",
  ).toBe(CEREAL_EMAIL);
});

test("VOR-093 caches and browser-decodes every distinct cereal media source", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  test.skip(
    test.info().project.name !== "laptop-1366",
    "The full media sweep runs once; responsive UI checks run separately.",
  );

  await signInMaintenanceManager(page);
  const accessToken = await authenticateCerealApi(page);
  const equipment = await loadVisibleMediaRecords(page, accessToken, "equipment");
  const spares = await loadVisibleMediaRecords(page, accessToken, "spare");

  expect(equipment, "Cereal equipment baseline changed").toHaveLength(35);
  expect(spares, "Cereal spare/component baseline changed").toHaveLength(177);
  expect(new Set(equipment.map((row) => row.site_id))).toEqual(new Set([CEREAL_SITE_ID]));
  expect(new Set(spares.map((row) => row.site_id))).toEqual(new Set([CEREAL_SITE_ID]));

  const equipmentSources = uniqueSourceTargets("equipment", equipment);
  const spareSources = uniqueSourceTargets("spare", spares);
  const targets = [...equipmentSources, ...spareSources];

  expect(equipmentSources.length).toBeGreaterThan(0);
  expect(spareSources.length).toBeGreaterThan(0);

  let passed = 0;
  const failures: string[] = [];
  for (const target of targets) {
    try {
      await cacheAndDecodeSource(page, accessToken, target);
      passed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${target.entityType}:${target.record.label} -> ${message}`);
      console.error(`[VOR-093 media failure] ${failures[failures.length - 1]}`);
    }
  }

  console.log(
    `[VOR-093 media] equipment=${equipment.length} spares=${spares.length} ` +
      `uniqueEquipment=${equipmentSources.length} uniqueSpares=${spareSources.length} ` +
      `browserDecoded=${passed} failures=${failures.length}`,
  );
  expect(
    failures,
    `Cereal media failures:\n${failures.join("\n")}`,
  ).toEqual([]);
  expect(passed).toBe(targets.length);
});

test("VOR-093 cereal production UI exposes working managed equipment and spare images", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await signInMaintenanceManager(page);
  const accessToken = await authenticateCerealApi(page);
  const equipment = await loadVisibleMediaRecords(page, accessToken, "equipment");
  expect(equipment).toHaveLength(35);

  const isPhone = (page.viewportSize()?.width ?? 1024) < 768;
  if (!isPhone) {
    await page.goto(`/equipment/${equipment[0].id}/overview`);
    const equipmentImage = page.locator('[data-vorta-equipment-image="true"]').first();
    await expect(equipmentImage).toHaveAttribute(
      "data-vorta-equipment-image-state",
      /^(?:verified|oem_cached|site_photo)$/,
      { timeout: 30_000 },
    );
    await expectRenderedImage(equipmentImage, "Equipment overview");
  }

  await page.goto("/stores-inventory?filter=all");
  const inventory = page.locator('[data-vorta-stores-inventory="true"]');
  await expect(inventory).toBeVisible({ timeout: 30_000 });
  const firstDisclosure = page.locator('[data-vorta-inventory-disclosure="true"]').first();
  await expect(firstDisclosure).toBeVisible();
  await firstDisclosure.locator("summary").click();

  const spareImage = firstDisclosure.locator('[data-vorta-spare-image="true"]');
  await expectRenderedImage(spareImage, "Stores Inventory spare");
  await expect(firstDisclosure.getByText("No verified image available")).toHaveCount(0);
});
