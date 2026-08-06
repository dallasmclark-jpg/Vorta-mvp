import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const read = (path) => readFileSync(path, "utf8");
const entrypoint = read("netlify/functions/ask-vorta.mts");
const wrapper = read("netlify/functions/ask-vorta/runtime-document-links.mts");
const helper = read("netlify/functions/ask-vorta/document-evidence-links.mts");
const frontend = read(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx",
);

assert.match(
  entrypoint,
  /runtime-document-links\.mjs/,
  "The production endpoint must enrich successful Ask Vorta answers with exact document links",
);
assert.match(
  entrypoint,
  /runtime-equipment-fallback\.mjs/,
  "The entrypoint must preserve the established equipment-fallback delegation marker",
);
for (const marker of [
  'import coreHandler from "./runtime-equipment-fallback.mjs"',
  "authenticateAskVortaRequest",
  '.from("knowledge_documents")',
  '"id,title,document_type,revision,approval_status,is_current,manual_section,page_number,drawing_number,sheet_number,source_url',
  '.eq("is_current", true)',
  '.ilike("approval_status", "approved")',
  "buildDocumentEvidenceLinks",
  "mergeEvidenceLinks",
]) {
  assert.ok(wrapper.includes(marker), `Missing document-link runtime marker: ${marker}`);
}
for (const marker of [
  "DOCUMENT_PATH_PATTERN",
  "safeDocumentPath",
  "source_url",
  "page_number",
  "sheet_number",
  "drawing_number",
  "Open manual:",
  "Open drawing:",
]) {
  assert.ok(helper.includes(marker), `Missing exact document-link helper marker: ${marker}`);
}
for (const marker of [
  'data-vorta-ai-evidence-links="true"',
  "navigate(link.path)",
  "ExternalLink",
]) {
  assert.ok(frontend.includes(marker), `The Ask Vorta UI must retain clickable evidence links: ${marker}`);
}

const temp = mkdtempSync(join(tmpdir(), "vorta-document-links-"));
try {
  const bundle = join(temp, "document-evidence-links.mjs");
  await build({
    entryPoints: [
      "netlify/functions/ask-vorta/document-evidence-links.mts",
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: bundle,
    logLevel: "silent",
  });
  const links = await import(
    `${pathToFileURL(bundle).href}?revision=${Date.now()}`
  );

  const equipmentId = "40000000-0000-0000-0000-000000000007";
  const manualPath =
    `/equipment/${equipmentId}/documents/958e1a34-8138-4252-8853-54fcef52b692?page=142`;
  const drawingPath =
    `/equipment/${equipmentId}/documents/83a10984-919c-4840-8e3c-a1458623549b?page=7`;
  const guidePath =
    `/equipment/${equipmentId}/documents/dbd95c1f-08ab-4224-a0dc-ba50651150e8?page=12`;
  const documents = [
    {
      title: "Bosch Vial Filler VF-02 Operating and Maintenance Manual",
      document_type: "OEM Manual",
      revision: "Rev 6",
      approval_status: "Approved",
      is_current: true,
      manual_section: "Section 7.4 Reject Monitoring",
      page_number: 142,
      source_url: manualPath,
      fault_codes: ["F-204", "F-207"],
      component_tags: ["reject station sensor", "HMI panel"],
      summary:
        "Reject confirmation timing, alignment checks and controlled reset steps.",
    },
    {
      title: "VF-02 Reject Station Electrical Drawing",
      document_type: "Electrical Drawing",
      approval_status: "Approved",
      is_current: true,
      drawing_number: "VF02-EL-204",
      sheet_number: "7",
      page_number: 7,
      source_url: drawingPath,
      fault_codes: ["F-204", "F-207"],
      component_tags: ["reject station sensor", "PLC digital input module"],
      summary: "Reject confirmation sensor circuit and PLC input address.",
    },
    {
      title: "VF-02 Reject Station Fault-Finding Guide",
      document_type: "Fault-Finding Guide",
      approval_status: "Approved",
      is_current: true,
      manual_section: "Fault Tree 2 False Rejects",
      page_number: 12,
      source_url: guidePath,
      fault_codes: ["F-204"],
      component_tags: ["reject station sensor", "M12 sensor cable"],
    },
    {
      title: "Unsafe external document",
      document_type: "Manual",
      approval_status: "Approved",
      is_current: true,
      source_url: "https://evil.example/manual.pdf?page=1",
    },
  ];
  const evidenceText = [
    "Vial filling sensor fault on VF-02.",
    "F-204 reject confirmation fault at the reject station sensor.",
    "Use the approved manual Section 7.4 on page 142.",
    "Check drawing VF02-EL-204 sheet 7 and Fault Tree 2.",
  ].join(" ");

  const documentLinks = links.buildDocumentEvidenceLinks(
    documents,
    evidenceText,
    6,
  );
  assert.ok(
    documentLinks.some((link) => link.path === manualPath),
    "The exact approved manual page link must be returned",
  );
  assert.ok(
    documentLinks.some((link) => link.path === drawingPath),
    "The exact electrical drawing sheet link must be returned",
  );
  assert.ok(
    documentLinks.some((link) => link.path === guidePath),
    "The exact fault-finding guide page link must be returned",
  );
  assert.ok(
    documentLinks.some(
      (link) => link.path === manualPath && /page 142/i.test(link.label),
    ),
    "The manual link label must expose page 142",
  );
  assert.ok(
    documentLinks.some(
      (link) => link.path === drawingPath && /sheet 7/i.test(link.label),
    ),
    "The drawing link label must expose sheet 7",
  );
  assert.equal(
    documentLinks.some((link) => link.path.startsWith("https://")),
    false,
    "Untrusted external document URLs must not enter Ask Vorta navigation",
  );

  const merged = links.mergeEvidenceLinks(documentLinks, [
    {
      label: "Open equipment register",
      path: "/equipment",
      recordType: "equipment",
    },
    {
      label: "Open asset documents",
      path: `/equipment/${equipmentId}/documents`,
      recordType: "document",
    },
  ]);
  assert.equal(
    merged[0].recordType,
    "document",
    "Exact source documents must appear before generic equipment navigation",
  );
  assert.ok(
    merged.findIndex((link) => link.path === manualPath) <
      merged.findIndex((link) => link.path === "/equipment"),
    "The exact manual page must not be hidden behind the first-eight link limit",
  );

  assert.equal(
    links.equipmentIdFromAnswer({
      conversationContext: {
        activeEquipment: { id: equipmentId, code: "VF-02" },
      },
    }),
    equipmentId,
    "The wrapper must resolve the selected equipment from structured conversation context",
  );
  assert.equal(
    links.equipmentIdFromAnswer({
      evidenceLinks: [
        {
          label: "Open equipment history",
          path: `/equipment/${equipmentId}/history`,
          recordType: "work",
        },
      ],
    }),
    equipmentId,
    "The wrapper must recover the equipment ID from existing equipment navigation",
  );
  assert.equal(
    links.safeDocumentPath(manualPath),
    manualPath,
    "Verified in-app document page paths must be accepted",
  );
  assert.equal(
    links.safeDocumentPath("https://evil.example/manual.pdf?page=1"),
    null,
    "External document paths must be rejected",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(
  "VOR-049 exact document deep-link contracts passed: approved manuals, drawings and guides retain their in-app page/sheet locators and appear before generic navigation.",
);
