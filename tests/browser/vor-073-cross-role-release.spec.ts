import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const userSiteAccessRoute = "**/rest/v1/user_site_access*";
const profileRoute = "**/rest/v1/profiles*";

const allowedSiteId =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000001";
const deniedSiteId =
  process.env.VORTA_E2E_DENIED_SITE_ID ??
  "11000000-0000-0000-0000-000000000002";
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

type TestRole =
  | "engineer"
  | "contractor_admin"
  | "contractor_engineer"
  | "production_manager"
  | "operator"
  | "maintenance_planner"
  | "reliability_engineer"
  | "site_admin";

type RoleCase = {
  role: TestRole;
  homePath: string;
  coreLabel: string;
  corePath: string;
  forbiddenPath: string;
  prototype: boolean;
};

const roleCases: RoleCase[] = [
  {
    role: "engineer",
    homePath: "/engineer/dashboard",
    coreLabel: "My Skills",
    corePath: "/engineer/skills",
    forbiddenPath: "/production/dashboard",
    prototype: false,
  },
  {
    role: "contractor_admin",
    homePath: "/contractor/dashboard",
    coreLabel: "Assignments",
    corePath: "/contractor/assignments",
    forbiddenPath: "/production/dashboard",
    prototype: true,
  },
  {
    role: "contractor_engineer",
    homePath: "/contractor/dashboard",
    coreLabel: "Assignments",
    corePath: "/contractor/assignments",
    forbiddenPath: "/operator/dashboard",
    prototype: true,
  },
  {
    role: "production_manager",
    homePath: "/production/dashboard",
    coreLabel: "Production Risk",
    corePath: "/production/risk",
    forbiddenPath: "/planner/planner-dashboard",
    prototype: true,
  },
  {
    role: "operator",
    homePath: "/operator/dashboard",
    coreLabel: "My Shift",
    corePath: "/operator/shift",
    forbiddenPath: "/contractor/dashboard",
    prototype: true,
  },
  {
    role: "maintenance_planner",
    homePath: "/planner/planner-dashboard",
    coreLabel: "Support",
    corePath: "/planner/support",
    forbiddenPath: "/production/dashboard",
    prototype: false,
  },
  {
    role: "reliability_engineer",
    homePath: "/dashboard",
    coreLabel: "Historical Validation",
    corePath: "/historical-validation",
    forbiddenPath: "/operator/dashboard",
    prototype: false,
  },
  {
    role: "site_admin",
    homePath: "/dashboard",
    coreLabel: "Engineers",
    corePath: "/engineers",
    forbiddenPath: "/engineer/dashboard",
    prototype: false,
  },
];

function routePattern(path: string): RegExp {
  return new RegExp(`${path.replaceAll("/", "\\/")}(?:\\?.*)?$`);
}

function rewriteRolePayload(payload: unknown, role: TestRole): unknown {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new Error(
        "Cross-role release proof requires at least one real RLS-visible access row.",
      );
    }

    return payload.map((row) => {
      if (!row || typeof row !== "object") {
        throw new Error("Unexpected authenticated access response shape.");
      }

      return {
        ...row,
        app_role: role,
        role,
      };
    });
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected authenticated profile response shape.");
  }

  return {
    ...payload,
    app_role: role,
    role,
  };
}

async function removeBrowserDemoAdminBypass(page: Page): Promise<void> {
  const updatedSessionCount = await page.evaluate(() => {
    const storages = [window.localStorage, window.sessionStorage];
    let updated = 0;

    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object") return;

      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }

      const objectValue = value as Record<string, unknown>;
      const user = objectValue.user;

      if (user && typeof user === "object") {
        const userValue = user as Record<string, unknown>;
        const appMetadata = userValue.app_metadata;

        if (appMetadata && typeof appMetadata === "object") {
          const appMetadataValue = appMetadata as Record<string, unknown>;
          if (appMetadataValue.demo_admin === true) {
            appMetadataValue.demo_admin = false;
            updated += 1;
          }
        }
      }

      for (const child of Object.values(objectValue)) visit(child);
    };

    for (const storage of storages) {
      const keys = Array.from({ length: storage.length }, (_, index) =>
        storage.key(index),
      ).filter((key): key is string => Boolean(key));

      for (const key of keys) {
        const raw = storage.getItem(key);
        if (!raw) continue;

        try {
          const parsed: unknown = JSON.parse(raw);
          const before = updated;
          visit(parsed);
          if (updated > before) {
            storage.setItem(key, JSON.stringify(parsed));
          }
        } catch {
          // Ignore unrelated non-JSON storage values.
        }
      }
    }

    return updated;
  });

  expect(
    updatedSessionCount,
    "The protected demo session must expose the deliberate demo-admin flag before ordinary-role simulation.",
  ).toBeGreaterThan(0);
}

async function installOrdinaryRoleOverride(
  context: BrowserContext,
  role: TestRole,
): Promise<{ siteAccessLookups: number }> {
  await context.unroute(userSiteAccessRoute);
  await context.unroute(profileRoute);

  const observation = { siteAccessLookups: 0 };

  await context.route(userSiteAccessRoute, async (route) => {
    observation.siteAccessLookups += 1;
    const response = await route.fetch();
    const payload: unknown = await response.json();

    await route.fulfill({
      response,
      json: rewriteRolePayload(payload, role),
    });
  });

  await context.route(profileRoute, async (route) => {
    const response = await route.fetch();
    const payload: unknown = await response.json();

    await route.fulfill({
      response,
      json: rewriteRolePayload(payload, role),
    });
  });

  return observation;
}

async function clickPortalNavigation(
  page: Page,
  label: string,
  expectedPath: string,
): Promise<void> {
  const viewportWidth = page.viewportSize()?.width ?? 0;

  if (viewportWidth < 768) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Portal navigation", exact: true });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: label, exact: true }).click();
  } else {
    const sidebar = page.locator('[data-vorta-desktop-sidebar="true"]');
    await sidebar.getByRole("link", { name: label, exact: true }).click();
  }

  await expect(page).toHaveURL(routePattern(expectedPath));
}

async function expectPortalState(page: Page, prototype: boolean): Promise<void> {
  await expect(page.locator('[data-vorta-portal-shell="true"]')).toBeVisible();

  if (prototype) {
    await expect(
      page.getByText("Prototype · non-operational", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Operational data is not connected for this role yet", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(/91% AI Confidence/i)).toHaveCount(0);
    await expect(page.getByText(/Operator absence logged/i)).toHaveCount(0);
  } else {
    await expect(
      page.getByText("Prototype · non-operational", { exact: true }),
    ).toHaveCount(0);
  }

  await expectNoPageOverflow(page);
}

async function storedAccessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const storages = [window.localStorage, window.sessionStorage];

    for (const storage of storages) {
      for (let index = 0; index < storage.length; index += 1) {
        const raw = storage.getItem(storage.key(index) ?? "");
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw) as {
            access_token?: unknown;
            currentSession?: { access_token?: unknown };
          };
          const token =
            typeof parsed.access_token === "string"
              ? parsed.access_token
              : parsed.currentSession?.access_token;
          if (typeof token === "string" && token.length > 0) return token;
        } catch {
          // Ignore unrelated storage values.
        }
      }
    }

    return "";
  });
}

async function verifyAllowedAndDeniedSiteBoundary(page: Page): Promise<void> {
  expect(supabaseUrl, "VITE_SUPABASE_URL must be configured").not.toBe("");
  expect(
    supabaseAnonKey,
    "VITE_SUPABASE_ANON_KEY must be configured",
  ).not.toBe("");

  const token = await storedAccessToken(page);
  expect(token, "The live browser session must expose a Supabase access token").not.toBe("");

  const today = new Date();
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 6);
  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/vorta_get_shift_cover_snapshot`;
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const data = {
    p_start_date: today.toISOString().slice(0, 10),
    p_end_date: end.toISOString().slice(0, 10),
  };

  const allowed = await page.request.post(endpoint, {
    headers,
    timeout: 30_000,
    data: { ...data, p_site_id: allowedSiteId },
  });
  expect(allowed.ok(), `Allowed site evidence failed: ${await allowed.text()}`).toBe(true);
  const allowedPayload = (await allowed.json()) as { siteId?: string } | null;
  expect(allowedPayload?.siteId).toBe(allowedSiteId);

  const denied = await page.request.post(endpoint, {
    headers,
    timeout: 30_000,
    data: { ...data, p_site_id: deniedSiteId },
  });
  expect(denied.ok(), `Denied site request must fail closed: ${await denied.text()}`).toBe(true);
  expect(await denied.json()).toBeNull();
}

test("every scoped portal keeps the correct role boundary and one core journey", async ({ page, context }, testInfo) => {
  await signInMaintenanceManager(page);

  if (testInfo.project.name === "desktop-1920") {
    await verifyAllowedAndDeniedSiteBoundary(page);
  }

  await removeBrowserDemoAdminBypass(page);

  for (const roleCase of roleCases) {
    const observation = await installOrdinaryRoleOverride(context, roleCase.role);

    await page.goto(roleCase.homePath);
    await expect.poll(() => observation.siteAccessLookups).toBeGreaterThan(0);
    await expect(page).toHaveURL(routePattern(roleCase.homePath));
    await expectPortalState(page, roleCase.prototype);

    await clickPortalNavigation(page, roleCase.coreLabel, roleCase.corePath);
    await expectPortalState(page, roleCase.prototype);

    await page.goto(roleCase.forbiddenPath);
    await expect(page).toHaveURL(routePattern(roleCase.homePath));
    await expectPortalState(page, roleCase.prototype);
  }

  if (testInfo.project.name === "phone-360") {
    // Protect the second common narrow-phone class without duplicating the full
    // role matrix. The production-manager truth gate is representative because
    // it uses the shared PortalShell and the same prototype evidence component.
    await page.setViewportSize({ width: 390, height: 844 });
    const observation = await installOrdinaryRoleOverride(context, "production_manager");
    await page.goto("/production/dashboard");
    await expect.poll(() => observation.siteAccessLookups).toBeGreaterThan(0);
    await expectPortalState(page, true);
  }

  await context.unroute(userSiteAccessRoute);
  await context.unroute(profileRoute);
});
