import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const userSiteAccessRoute = "**/rest/v1/user_site_access*";
const profileRoute = "**/rest/v1/profiles*";

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

type FutureRole = (typeof roleCases)[number]["role"];

type RoleOverrideObservation = {
  siteAccessLookups: number;
  profileLookups: number;
};

function routePattern(route: string): RegExp {
  return new RegExp(`${route.replaceAll("/", "\\/")}(?:\\?.*)?$`);
}

function withRoleOverride(payload: unknown, role: FutureRole): unknown {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new Error(
        "Future-role browser proof requires at least one real RLS-visible access row.",
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

async function installAuthorisedRoleOverride(
  context: BrowserContext,
  role: FutureRole,
): Promise<RoleOverrideObservation> {
  await context.unroute(userSiteAccessRoute);
  await context.unroute(profileRoute);

  const observation: RoleOverrideObservation = {
    siteAccessLookups: 0,
    profileLookups: 0,
  };

  await context.route(userSiteAccessRoute, async (route) => {
    observation.siteAccessLookups += 1;
    const response = await route.fetch();
    const payload: unknown = await response.json();

    await route.fulfill({
      response,
      json: withRoleOverride(payload, role),
    });
  });

  await context.route(profileRoute, async (route) => {
    observation.profileLookups += 1;
    const response = await route.fetch();
    const payload: unknown = await response.json();

    await route.fulfill({
      response,
      json: withRoleOverride(payload, role),
    });
  });

  return observation;
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

test("authenticated Maintenance Manager remains blocked from future-role portal boundaries", async ({ page }) => {
  // The Vorta Supabase client deliberately keeps a non-remembered session in
  // sessionStorage, which Playwright storageState does not serialise. Sign in on
  // the actual project page so this is a real role-isolation assertion rather
  // than an unauthenticated redirect that happens to look correct.
  await signInMaintenanceManager(page);

  for (const route of crossRoleRoutes) {
    await page.goto(route);
    await expect(page).not.toHaveURL(routePattern(route));
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await expect(
      page.getByText("Prototype · non-operational", { exact: true }),
    ).toHaveCount(0);
  }
});

test("authorised future-role shells show honest non-operational evidence state", async ({ page, context }) => {
  // Establish the real protected Supabase session in this tab first. Full page
  // navigations retain the same tab's sessionStorage, then AuthProvider performs
  // fresh profile/site-access hydration through the browser-only role override.
  // Real JWT plus RLS-visible site/organisation rows are retained and no grant is
  // mutated in Supabase.
  await signInMaintenanceManager(page);

  for (const roleCase of roleCases) {
    const observation = await installAuthorisedRoleOverride(
      context,
      roleCase.role,
    );

    for (const route of roleCase.routes) {
      await page.goto(route);

      await expect
        .poll(() => observation.siteAccessLookups)
        .toBeGreaterThan(0);
      await expect
        .poll(() => observation.profileLookups)
        .toBeGreaterThan(0);

      await expect(page).toHaveURL(routePattern(route));
      await expectHonestUnavailableState(page);
    }
  }

  await context.unroute(userSiteAccessRoute);
  await context.unroute(profileRoute);
});
