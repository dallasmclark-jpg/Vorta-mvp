import { defineConfig } from "@playwright/test";

const baseURL = process.env.VORTA_E2E_BASE_URL ?? "http://127.0.0.1:4173";
const hasAuthenticatedTestUser = Boolean(process.env.VORTA_E2E_PASSWORD);
const maintenanceManagerAuthState =
  "playwright/.auth/maintenance-manager.json";
const askVortaLiveEval = /vor-033-ask-vorta-live-eval\.spec\.ts/;
const samsungTabletUserAgent =
  "Mozilla/5.0 (Linux; Android 15; SM-X910 Build/AP3A.240905.015.A2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const samsungDesktopModeUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

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
  maxFailures: process.env.CI ? 1 : undefined,
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
          {
            name: "ask-vorta-live",
            dependencies: ["auth-setup"],
            testMatch: askVortaLiveEval,
            use: {
              storageState: maintenanceManagerAuthState,
              viewport: { width: 1366, height: 768 },
            },
          },
        ]
      : []),
    {
      name: "phone-360",
      ...authenticatedProject,
      testIgnore: askVortaLiveEval,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "samsung-tablet-portrait",
      ...authenticatedProject,
      testIgnore: askVortaLiveEval,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 1024, height: 1536 },
        hasTouch: true,
        userAgent: samsungTabletUserAgent,
      },
    },
    {
      name: "samsung-tablet-landscape",
      ...authenticatedProject,
      testIgnore: askVortaLiveEval,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 1536, height: 1024 },
        hasTouch: true,
        userAgent: samsungDesktopModeUserAgent,
      },
    },
    {
      name: "laptop-1366",
      ...authenticatedProject,
      testIgnore: askVortaLiveEval,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "desktop-1920",
      ...authenticatedProject,
      testIgnore: askVortaLiveEval,
      use: {
        ...authenticatedProject.use,
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
