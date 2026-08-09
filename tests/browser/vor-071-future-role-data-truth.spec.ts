import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { expectNoPageOverflow } from "./maintenance-manager-test-helpers";

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

test("Maintenance Manager remains blocked from future-role portal boundaries", async ({ page }) => {
  for (const route of crossRoleRoutes) {
    await page.goto(route);
    await expect(page).not.toHaveURL(routePattern(route));
    await expect(
      page.getByText("Prototype · non-operational", { exact: true }),
    ).toHaveCount(0);
  }
});

test("authorised future-role shells show honest non-operational evidence state", async ({ context }) => {
  // Keep the real authenticated JWT and real RLS-visible site/organisation rows.
  // Install the response override on the BrowserContext before each fresh page is
  // created so AuthProvider cannot hydrate the Maintenance Manager role first.
  // No Supabase grant is mutated by this browser-only proof.
  for (const roleCase of roleCases) {
    const observation = await installAuthorisedRoleOverride(
      context,
      roleCase.role,
    );
    const rolePage = await context.newPage();

    try {
      for (const route of roleCase.routes) {
        await rolePage.goto(route);

        await expect
          .poll(() => observation.siteAccessLookups)
          .toBeGreaterThan(0);
        await expect
          .poll(() => observation.profileLookups)
          .toBeGreaterThan(0);

        await expect(rolePage).toHaveURL(routePattern(route));
        await expectHonestUnavailableState(rolePage);
      }
    } finally {
      await rolePage.close();
    }
  }

  await context.unroute(userSiteAccessRoute);
  await context.unroute(profileRoute);
});
