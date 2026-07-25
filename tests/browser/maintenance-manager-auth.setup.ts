import { existsSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

export const maintenanceManagerAuthState =
  "playwright/.auth/maintenance-manager.json";

setup("authenticate the Maintenance Manager test session once", async ({ page }) => {
  if (existsSync(maintenanceManagerAuthState)) {
    return;
  }

  await signInMaintenanceManager(page);
  await page.context().storageState({ path: maintenanceManagerAuthState });
});
