import { defineConfig } from "@playwright/test";

const baseURL = process.env.VORTA_E2E_BASE_URL ?? "http://127.0.0.1:4173";
const hasAuthenticatedTestUser = Boolean(process.env.VORTA_E2E_PASSWORD);
const maintenanceManagerAuthState =
  "playwright/.auth/maintenance-manager.json";

const authenticatedProject = hasAuthenticatedTestUser
  ? {
      dependencies: ["auth-setup"],
      use: { storageState: maintenanceManagerAuthState },
    }
  : {};

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.VORTA_E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 4173",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    ...(hasAuthenticatedTestUser
      ? [
          {
            name: "auth-setup",
            testMatch: /maintenance-manager-auth\.setup\.ts/,
          },
        ]
      : []),
    {
      name: "phone-360",
      ...authenticatedProject,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "samsung-tablet-portrait",
      ...authenticatedProject,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 800, height: 1280 },
      },
    },
    {
      name: "samsung-tablet-landscape",
      ...authenticatedProject,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "laptop-1366",
      ...authenticatedProject,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "desktop-1920",
      ...authenticatedProject,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
