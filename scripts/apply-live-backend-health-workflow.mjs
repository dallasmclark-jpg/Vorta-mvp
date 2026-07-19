import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL(
  "../.github/workflows/maintenance-manager-quality.yml",
  import.meta.url,
);
const source = readFileSync(path, "utf8");
const marker = `      - name: Install browser-test runner without changing the lockfile\n`;
const insertion = `      - name: Run authenticated live backend health gate\n        id: live-backend-health\n        continue-on-error: true\n        shell: bash\n        run: |\n          set -o pipefail\n          node scripts/live-demo-backend-health.mjs 2>&1 | tee live-backend-health.log\n\n      - name: Preserve live backend health evidence\n        if: steps.live-backend-health.outcome == 'failure'\n        uses: actions/upload-artifact@v4\n        with:\n          name: live-backend-health-report\n          path: live-backend-health.log\n          retention-days: 7\n\n      - name: Enforce live backend health result\n        if: steps.live-backend-health.outcome == 'failure'\n        run: exit 1\n\n`;

assert.equal(
  source.split(marker).length - 1,
  1,
  "Expected one browser-runner installation marker",
);
assert.ok(
  !source.includes("Run authenticated live backend health gate"),
  "Live backend health gate is already installed",
);
writeFileSync(path, source.replace(marker, `${insertion}${marker}`));
console.log("Live backend health workflow installed.");
