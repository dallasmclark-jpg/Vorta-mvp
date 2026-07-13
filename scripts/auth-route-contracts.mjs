import {
  readFileSync,
} from "node:fs";

const authSource =
  readFileSync(
    new URL(
      "../src/lib/auth.tsx",
      import.meta.url,
    ),
    "utf8",
  );

const routeSource =
  readFileSync(
    new URL(
      "../src/index.tsx",
      import.meta.url,
    ),
    "utf8",
  );

const compact = (value) =>
  value.replace(/\s+/g, "");

const compactAuth =
  compact(authSource);

const compactRoutes =
  compact(routeSource);

const failures = [];

const check = (
  name,
  condition,
) => {
  if (condition) {
    console.log(`✓ ${name}`);
    return;
  }

  failures.push(name);
  console.error(`✗ ${name}`);
};

const contains = (
  source,
  expected,
) => source.includes(
  compact(expected),
);

const countOccurrences = (
  source,
  value,
) => {
  let count = 0;
  let position = 0;

  while (true) {
    const foundAt =
      source.indexOf(
        value,
        position,
      );

    if (foundAt === -1) {
      return count;
    }

    count += 1;
    position =
      foundAt + value.length;
  }
};

const requiredRoles = [
  "vorta_admin",
  "site_admin",
  "maintenance_manager",
  "maintenance_planner",
  "reliability_engineer",
  "engineer",
  "production_manager",
  "operator",
  "contractor_admin",
  "contractor_engineer",
];

for (
  const role of requiredRoles
) {
  check(
    `PilotRole contains ${role}`,
    authSource.includes(
      `"${role}"`,
    ),
  );
}

check(
  "Global administrator bypass is preserved",
  contains(
    compactAuth,
    `
      const hasGlobalAdminAccess =
        isDemoAdmin ||
        role === "vorta_admin";
    `,
  ),
);

check(
  "Ordinary users require an active site context",
  contains(
    compactAuth,
    `
      if (
        !hasGlobalAdminAccess &&
        !siteContext
      )
    `,
  ),
);

check(
  "Missing site assignment has an explicit error",
  authSource.includes(
    "Your account does not have an active Vorta site assignment.",
  ),
);

check(
  "Unsupported roles have an explicit error",
  authSource.includes(
    "Your account does not have a supported Vorta portal role.",
  ),
);

check(
  "Access decision uses global admin or allowed roles",
  contains(
    compactAuth,
    `
      const hasAccess =
        hasGlobalAdminAccess ||
        allowedRoles.includes(role);
    `,
  ),
);

const homePathContracts = [
  [
    "engineer",
    "/engineer/dashboard",
  ],
  [
    "contractor_admin",
    "/contractor/dashboard",
  ],
  [
    "contractor_engineer",
    "/contractor/dashboard",
  ],
  [
    "production_manager",
    "/production/dashboard",
  ],
  [
    "operator",
    "/operator/dashboard",
  ],
  [
    "maintenance_planner",
    "/planner/planner-dashboard",
  ],
];

for (
  const [
    role,
    path,
  ] of homePathContracts
) {
  check(
    `${role} home path remains ${path}`,
    authSource.includes(
      `"${role}"`,
    ) &&
      authSource.includes(
        `"${path}"`,
      ),
  );
}

const requiredRoutes = [
  "/engineer/*",
  "/contractor/*",
  "/production/*",
  "/operator/*",
  "/planner/*",
  "/*",
];

for (
  const route of requiredRoutes
) {
  check(
    `Route exists: ${route}`,
    routeSource.includes(
      `path="${route}"`,
    ),
  );
}

check(
  "Engineer portal requires engineer role",
  contains(
    compactRoutes,
    `
      <RequireRole role="engineer">
    `,
  ),
);

check(
  "Contractor portal accepts both contractor roles",
  contains(
    compactRoutes,
    `
      role={[
        "contractor_admin",
        "contractor_engineer",
      ]}
    `,
  ),
);

check(
  "Production portal requires production manager",
  contains(
    compactRoutes,
    `
      role="production_manager"
    `,
  ),
);

check(
  "Operator portal requires operator",
  contains(
    compactRoutes,
    `
      <RequireRole role="operator">
    `,
  ),
);

check(
  "Planner portal requires maintenance planner",
  contains(
    compactRoutes,
    `
      role="maintenance_planner"
    `,
  ),
);

check(
  "Maintenance portal accepts the approved manager roles",
  contains(
    compactRoutes,
    `
      role={[
        "maintenance_manager",
        "site_admin",
        "reliability_engineer",
      ]}
    `,
  ),
);

check(
  "Generic RequireAuth route guards are not used",
  !routeSource.includes(
    "<RequireAuth",
  ),
);

check(
  "Every protected portal has a route error boundary",
  countOccurrences(
    compactRoutes,
    "<VortaRouteErrorBoundary>",
  ) === 6,
);

check(
  "Application root error boundary remains present",
  contains(
    compactRoutes,
    `
      <VortaErrorBoundary scope="application">
    `,
  ),
);

check(
  "Legacy engineer redirect remains intact",
  routeSource.includes(
    'to="/engineer/dashboard"',
  ),
);

check(
  "Legacy contractor redirect remains intact",
  routeSource.includes(
    'to="/contractor/dashboard"',
  ),
);

if (
  failures.length > 0
) {
  console.error(
    `\n${failures.length} auth or routing contract check${failures.length === 1 ? "" : "s"} failed.`,
  );

  process.exit(1);
}

console.log(
  "\nAll Vorta auth and routing contracts passed.",
);
