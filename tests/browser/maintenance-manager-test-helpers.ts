import { expect, type Locator, type Page } from "@playwright/test";

export const maintenanceManagerEmail =
  process.env.VORTA_E2E_EMAIL ?? "demo@vorta.network";
export const maintenanceManagerPassword = process.env.VORTA_E2E_PASSWORD ?? "";
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const allowedSiteId =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000001";
const deniedSiteId =
  process.env.VORTA_E2E_DENIED_SITE_ID ??
  "11000000-0000-0000-0000-000000000002";

export async function signInMaintenanceManager(page: Page): Promise<void> {
  expect(
    maintenanceManagerPassword,
    "VORTA_E2E_PASSWORD must be configured as a protected CI secret",
  ).not.toBe("");

  await page.goto("/");
  await page.getByLabel("Email").fill(maintenanceManagerEmail);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(maintenanceManagerPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
}

export async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
      })),
    )
    .toMatchObject({
      viewport: await page.evaluate(() => window.innerWidth),
    });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "The portal must not overflow the viewport").toBeLessThanOrEqual(2);
}

export async function expectOperationalTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, "Operational control must be visible").not.toBeNull();
  expect(
    box?.height ?? 0,
    "Operational control must be at least 40px high",
  ).toBeGreaterThanOrEqual(39.5);
}

async function authenticateSupabaseTestUser(page: Page): Promise<string> {
  const authEndpoint = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`;
  const authResponse = await page.request.post(authEndpoint, {
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    data: {
      email: maintenanceManagerEmail,
      password: maintenanceManagerPassword,
    },
  });

  expect(
    authResponse.ok(),
    `Supabase test-user authentication failed: ${await authResponse.text()}`,
  ).toBe(true);

  const payload = (await authResponse.json()) as { access_token?: unknown };
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : "";
  expect(
    accessToken,
    "Authenticated Supabase access token must be available",
  ).not.toBe("");
  return accessToken;
}

export async function verifyCrossSiteIsolation(page: Page): Promise<void> {
  expect(supabaseUrl, "VITE_SUPABASE_URL must be configured").not.toBe("");
  expect(
    supabaseAnonKey,
    "VITE_SUPABASE_ANON_KEY must be configured",
  ).not.toBe("");

  const accessToken = await authenticateSupabaseTestUser(page);
  const today = new Date();
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 6);
  const startDate = today.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/vorta_get_shift_cover_snapshot`;
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const allowedResponse = await page.request.post(endpoint, {
    headers,
    data: {
      p_site_id: allowedSiteId,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  });
  expect(
    allowedResponse.ok(),
    `Allowed site snapshot failed: ${await allowedResponse.text()}`,
  ).toBe(true);
  const allowedSnapshot = (await allowedResponse.json()) as {
    siteId?: string;
    calendar?: unknown[];
  } | null;
  expect(allowedSnapshot).not.toBeNull();
  expect(allowedSnapshot?.siteId).toBe(allowedSiteId);
  expect(allowedSnapshot?.calendar?.length ?? 0).toBeGreaterThan(0);

  const deniedResponse = await page.request.post(endpoint, {
    headers,
    data: {
      p_site_id: deniedSiteId,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  });
  expect(
    deniedResponse.ok(),
    `Denied site request should fail closed without leaking data: ${await deniedResponse.text()}`,
  ).toBe(true);
  expect(await deniedResponse.json()).toBeNull();
}

export async function openFirstDifferentAiWorkOrder(
  historyButtons: Locator,
  currentWorkOrder: string,
): Promise<string> {
  const count = await historyButtons.count();
  expect(
    count,
    "Ask Vorta must return at least one linked work order",
  ).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const candidate = historyButtons.nth(index);
    const workOrderNumber =
      (await candidate.locator("span").first().textContent())?.trim() ?? "";
    if (/^WO-/i.test(workOrderNumber) && workOrderNumber !== currentWorkOrder) {
      await candidate.click();
      return workOrderNumber;
    }
  }

  throw new Error("Ask Vorta did not return a different linked work order.");
}
