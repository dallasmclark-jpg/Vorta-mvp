import { expect, test, type Page } from "@playwright/test";
import { expectNoPageOverflow } from "./maintenance-manager-test-helpers";

const userSiteAccessRoute = "**/rest/v1/user_site_access*";

const roleCases = [
  {
    role: "production_manager",
    routes: ["/production/dashboard", "/production/risk"],
  },
  {
    role: "operator",
    routes: ["/operator/dashboard", "/operator/shift"],
  },
  {
    role: "contractor_admin",
    routes: ["/contractor/dashboard", "/contractor/assignments"],
  },
] as const;

const crossRoleRoutes = roleCases.map(({ routes }) => routes[0]);

function routePattern(route: string): RegExp {
  return new RegExp(`${route.replaceAll("/", "\\/")}(?:\\?.*)?$`);
}

async function mockAuthorisedSiteRole(
  page: Page,
  role: (typeof roleCases)[number]["role"],
): Promise<void> {
  await page.unroute(userSiteAccessRoute);

  await page.route(userSiteAccessRoute, async (route) => {
    const response = await route.fetch();
    const payload: unknown = await response.json();

    if (!Array.isArray(payload) || payload.length === 0) {
      throw new Error(
        "Future-role browser proof requires at least one real RLS-visible site-access grant.",
      );
    }

    const roleScopedPayload = payload.map((row) => {
      if (!row || typeof row !== "object") {
        throw new Error("Unexpected user_site_access response shape.");
      }

      return {
        ...row,
        app_role: role,
      };
    });

    await route.fulfill({
      response,
      json: roleScopedPayload,
    });
  });
}

async function expectHonestUnavailableState(page: Page): Promise<void> {
  await expect(
    page.getByText("Prototype · non-operational", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Operational data is not connected for this role yet",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Evidence state", { exact: true })).toBeVisible();
  await expect(page.getByText("Access boundary", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/No approved live role-specific data feed is connected/i),
  ).toBeVisible();

  await expect(page.getByText(/91% AI Confidence/i)).toHaveCount(0);
  await expect(page.getByText(/Line 3 changeover understaffed/i)).toHaveCount(0);
  await expect(page.getByText(/Operator absence logged/i)).toHaveCount(0);
  await expect(page.getByText(/synthetic|mock data/i)).toHaveCount(0);

  await expectNoPageOverflow(page);
}

test("Maintenance Manager remains blocked from future-role portal boundaries", async ({ page }) => {
  for (const route of crossRoleRoutes) {
    await page.goto(route);
    await expect(page).not.toHaveURL(routePattern(route));
    await expect(
      page.getByText("Prototype · non-operational", { exact: true }),
    ).toHaveCount(0);
  }
});

test("authorised future-role shells show honest non-operational evidence state", async ({ page }) => {
  // Keep the real authenticated JWT and real RLS-visible site/organisation rows.
  // Only the browser-test response's site-specific role is substituted so each
  // future portal can be rendered without mutating Supabase access grants.
  for (const roleCase of roleCases) {
    await mockAuthorisedSiteRole(page, roleCase.role);

    for (const route of roleCase.routes) {
      await page.goto(route);
      await expect(page).toHaveURL(routePattern(route));
      await expectHonestUnavailableState(page);
    }
  }

  await page.unroute(userSiteAccessRoute);
});
