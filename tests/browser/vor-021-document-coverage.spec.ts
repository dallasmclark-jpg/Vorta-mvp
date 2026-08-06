import { expect, test, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const fullTextEquipmentId = "40000000-0000-0000-0000-000000000003";
const fullTextDocumentId = "56b3db95-78f2-4b62-80fa-7daf97767563";
const summaryOnlyEquipmentId = "25862bbb-e6b7-47d0-b987-f1985d8a4a81";
const summaryOnlyDocumentId = "037752d4-6e63-41ec-bee9-2f98489be484";
const unavailableDocumentId = "dddddddd-1111-2222-3333-444444444444";

async function expectCoverage(
  page: Page,
  mode: "full_text" | "summary_only",
  label: string,
  reason: RegExp,
): Promise<void> {
  const badge = page.locator(`[data-vorta-document-coverage="${mode}"]`).first();
  await expect(badge).toBeVisible();
  await expect(badge).toContainText(label);
  const note = page.locator(`[data-vorta-document-coverage-note="${mode}"]`).first();
  await expect(note).toBeVisible();
  await expect(note).toContainText(reason);
  await expectNoPageOverflow(page);
}

test.describe("VOR-021 and VOR-061 governed document evidence", () => {
  test("full-text drawing remains citation-ready with exact revision and locator", async ({ page }) => {
    await signInMaintenanceManager(page);
    await page.goto(`/equipment/${fullTextEquipmentId}/documents/${fullTextDocumentId}`);

    await expect(
      page.getByRole("heading", { name: "A-02 Door Interlock Electrical Drawing", exact: true }),
    ).toBeVisible();
    await expectCoverage(
      page,
      "full_text",
      "Full-text indexed",
      /Approved full-text evidence sections are indexed and citation-ready/i,
    );
    await expect(page.getByText("Revision Rev E", { exact: true })).toBeVisible();
    await expect(page.getByText(/AUT2-EL-310/).first()).toBeVisible();
    await expect(page.getByText("Page 12", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/X31:4/).first()).toBeVisible();
    await expect(page.getByText(/I5\.2/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask Vorta", exact: true }).first()).toBeEnabled();
  });

  test("summary-only manual is never presented as full source text", async ({ page }) => {
    await signInMaintenanceManager(page);
    await page.goto(`/equipment/${summaryOnlyEquipmentId}/documents/${summaryOnlyDocumentId}`);

    await expect(
      page.getByRole("heading", { name: "Atlas Copco CDA-01 Operating and Maintenance Manual", exact: true }),
    ).toBeVisible();
    await expectCoverage(
      page,
      "summary_only",
      "Summary-only coverage",
      /Only the approved document summary is indexed; the full source text is not indexed/i,
    );
    await expect(page.getByText("Revision 01", { exact: true })).toBeVisible();
    await expect(page.getByText(/CDA-01-OM-001/).first()).toBeVisible();
    await expect(page.getByText("Page 42", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Approved summary", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Full-text indexed", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Back to documents", exact: true }).click();
    await page.waitForURL(new RegExp(`/equipment/${summaryOnlyEquipmentId}/documents$`));
    await page.getByRole("textbox", { name: "Search controlled documents" }).fill("Atlas Copco CDA-01");
    const card = page
      .getByRole("heading", { name: "Atlas Copco CDA-01 Operating and Maintenance Manual", exact: true })
      .locator("xpath=ancestor::article[1]");
    await expect(card.locator('[data-vorta-document-coverage="summary_only"]')).toContainText(
      "Summary-only coverage",
    );
    await expect(card).toContainText("full source text is not indexed");
    await expectNoPageOverflow(page);
  });

  test("unknown or role-inaccessible document does not disclose access state", async ({ page }) => {
    await signInMaintenanceManager(page);
    await page.goto(`/equipment/${fullTextEquipmentId}/documents/${unavailableDocumentId}`);

    await expect(
      page.getByText(
        "This document is not available for the authorised equipment and site.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText(/superseded|obsolete|not approved/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ask Vorta", exact: true })).toHaveCount(0);
    await expectNoPageOverflow(page);
  });
});
