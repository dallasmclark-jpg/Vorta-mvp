import type { EquipmentDocument } from "./equipmentTypes";

export type DocumentDiagram =
  | "reject-timing"
  | "electrical-reject-circuit"
  | "pneumatic-reject-circuit"
  | "reject-fault-tree"
  | "pm-functional-test"
  | "calibration-result";

export interface DocumentTable {
  headers: string[];
  rows: string[][];
}

export interface DocumentPageContent {
  pageNumber: number;
  heading: string;
  eyebrow?: string;
  paragraphs?: string[];
  bullets?: string[];
  warning?: string;
  table?: DocumentTable;
  diagram?: DocumentDiagram;
}

export interface DocumentSection {
  page: number;
  label: string;
}

export interface DemoDocumentDefinition {
  reference: string;
  title: string;
  documentType: string;
  revision: string;
  pageCount: number;
  controlledStatus: string;
  sections: DocumentSection[];
  getPage: (pageNumber: number) => DocumentPageContent;
}

function clampPage(pageNumber: number, pageCount: number): number {
  return Math.max(1, Math.min(pageCount, Math.round(pageNumber)));
}

function currentSection(
  sections: DocumentSection[],
  pageNumber: number,
): DocumentSection {
  return [...sections]
    .reverse()
    .find((section) => section.page <= pageNumber) ?? sections[0];
}

function genericPage(
  definition: Pick<DemoDocumentDefinition, "sections" | "pageCount" | "reference">,
  pageNumber: number,
  subject: string,
): DocumentPageContent {
  const page = clampPage(pageNumber, definition.pageCount);
  const section = currentSection(definition.sections, page);
  return {
    pageNumber: page,
    eyebrow: `${definition.reference} · ${section.label}`,
    heading: section.label,
    paragraphs: [
      `This controlled demo page forms part of the ${subject}. It preserves the document structure, page references and maintenance context used by Vorta search and citation workflows.`,
      "Site execution must follow the approved local controlled copy, isolation standard and permit requirements. Any conflict between this demonstration and the customer source system must be resolved in favour of the customer-controlled record.",
    ],
    bullets: [
      "Confirm equipment identity and safe state before intervention.",
      "Record observations against the linked work order or maintenance task.",
      "Escalate damaged, missing or superseded evidence through document control.",
    ],
  };
}

const manualSections: DocumentSection[] = [
  { page: 1, label: "Document control and scope" },
  { page: 8, label: "Safety and isolation" },
  { page: 20, label: "Machine overview" },
  { page: 38, label: "Operating sequence" },
  { page: 62, label: "Format change and setup" },
  { page: 82, label: "Preventive maintenance" },
  { page: 108, label: "Diagnostics and alarms" },
  { page: 132, label: "Reject system" },
  { page: 148, label: "Revision history" },
];

const manual: DemoDocumentDefinition = {
  reference: "VF02-OM-001",
  title: "VF-02 Operating and Maintenance Manual",
  documentType: "OEM Manual",
  revision: "Rev D",
  pageCount: 150,
  controlledStatus: "Demo controlled copy",
  sections: manualSections,
  getPage(pageNumber) {
    const page = clampPage(pageNumber, 150);
    if (page === 1) {
      return {
        pageNumber: page,
        eyebrow: "Controlled equipment manual",
        heading: "VF-02 Operating and Maintenance Manual",
        paragraphs: [
          "This demonstration manual supports the Vorta maintenance-intelligence pilot for vial filler VF-02. It is synthetic training content and is not issued by the original equipment manufacturer.",
          "The document is arranged as a complete 150-page controlled manual so Vorta can demonstrate exact page citations, section navigation and evidence-linked fault investigation.",
        ],
        warning:
          "DEMO DOCUMENT: Do not use this document to operate or maintain production equipment.",
        table: {
          headers: ["Reference", "Revision", "Owner", "Status"],
          rows: [["VF02-OM-001", "Rev D", "Engineering Document Control", "Current demo"]],
        },
      };
    }
    if (page === 142) {
      return {
        pageNumber: page,
        eyebrow: "Section 7.4 · Reject monitoring",
        heading: "Reject confirmation timing and sensor checks",
        paragraphs: [
          "The reject confirmation sensor must switch within the configured validation window after the pneumatic reject command. A missing transition raises fault F-204. A confirmation that remains active beyond the reset window raises fault F-207.",
          "Before changing PLC timing, inspect the sensor lens, target alignment, bracket security and M12 connector. Contamination at the lower switching-distance limit can create intermittent confirmation without an electrical component failure.",
        ],
        bullets: [
          "Nominal switching distance: 4.0 mm, site acceptance range 3.5-4.5 mm.",
          "PLC input: I3.7 through terminal X12:14.",
          "Reject command output: Q4.2 to solenoid YV-204.",
          "Confirmation must be present 80-220 ms after reject command.",
        ],
        warning:
          "Do not bypass reject confirmation. If the sensor cannot be proven, place the machine in a safe state and escalate to production quality.",
        diagram: "reject-timing",
      };
    }
    if (page === 143) {
      return {
        pageNumber: page,
        eyebrow: "Section 7.4 · Controlled reset",
        heading: "F-204 and F-207 controlled reset sequence",
        paragraphs: [
          "A reset is permitted only after the reject path is clear, the sensor input has returned to its healthy state and the operator confirms that the challenged container was removed from the accepted product stream.",
        ],
        table: {
          headers: ["Step", "Action", "Expected indication"],
          rows: [
            ["1", "Stop feed and isolate product flow", "Machine safe / no container transfer"],
            ["2", "Clean and align confirmation sensor", "Input I3.7 healthy"],
            ["3", "Perform single-container challenge", "Reject confirmed inside timing window"],
            ["4", "Reset alarm and record result", "F-204/F-207 cleared"],
          ],
        },
      };
    }
    if (page === 108) {
      return {
        pageNumber: page,
        eyebrow: "Diagnostics and alarms",
        heading: "Alarm investigation principles",
        paragraphs: [
          "Use the alarm code, event timestamp and current machine state together. Do not replace components solely because an alarm names a device; the alarm indicates the failed condition, not necessarily the failed part.",
        ],
        bullets: [
          "Compare the alarm timestamp with work-order and batch events.",
          "Use the electrical drawing to verify the input path.",
          "Use the pneumatic drawing to verify actuator response.",
          "Record the as-found state before adjustment.",
        ],
      };
    }
    return genericPage(manual, page, "VF-02 operating and maintenance manual");
  },
};

const electricalSections: DocumentSection[] = Array.from({ length: 12 }, (_, index) => ({
  page: index + 1,
  label: `Sheet ${index + 1}`,
}));

const electrical: DemoDocumentDefinition = {
  reference: "VF02-EL-204",
  title: "VF-02 Reject Station Electrical Drawing",
  documentType: "Electrical Drawing",
  revision: "Rev F",
  pageCount: 12,
  controlledStatus: "Demo controlled drawing",
  sections: electricalSections,
  getPage(pageNumber) {
    const page = clampPage(pageNumber, 12);
    if (page === 7) {
      return {
        pageNumber: page,
        eyebrow: "Drawing VF02-EL-204 · Sheet 7",
        heading: "Reject station inputs and outputs",
        paragraphs: [
          "Sheet 7 identifies the reject confirmation sensor supply, M12 connector, terminal strip and PLC input path used by the F-204/F-207 monitoring logic.",
        ],
        bullets: [
          "B204 reject confirmation sensor, 24 VDC PNP.",
          "Connector M12-B204, pin 4 signal.",
          "Terminal X12:14 to PLC input I3.7.",
          "Solenoid YV-204 driven by PLC output Q4.2.",
        ],
        diagram: "electrical-reject-circuit",
      };
    }
    return {
      ...genericPage(electrical, page, "VF-02 electrical drawing pack"),
      heading: `Electrical distribution and control - Sheet ${page}`,
    };
  },
};

const pneumaticSections: DocumentSection[] = Array.from({ length: 8 }, (_, index) => ({
  page: index + 1,
  label: `Sheet ${index + 1}`,
}));

const pneumatic: DemoDocumentDefinition = {
  reference: "VF02-PN-112",
  title: "VF-02 Reject Mechanism Pneumatic Drawing",
  documentType: "Pneumatic Drawing",
  revision: "Rev C",
  pageCount: 8,
  controlledStatus: "Demo controlled drawing",
  sections: pneumaticSections,
  getPage(pageNumber) {
    const page = clampPage(pageNumber, 8);
    if (page === 3) {
      return {
        pageNumber: page,
        eyebrow: "Drawing VF02-PN-112 · Sheet 3",
        heading: "Reject cylinder pneumatic circuit",
        paragraphs: [
          "The reject cylinder is controlled by valve YV-204 through manifold station V04. Slow response can result from low regulated pressure, restricted exhaust, contamination or cylinder seal drag.",
        ],
        bullets: [
          "Regulator PR-204 set point: 5.5 bar.",
          "Cylinder CY-204 bore 25 mm, stroke 80 mm.",
          "Flow controls FC-204A/B must be adjusted symmetrically.",
          "Confirm exhaust silencer is not restricted before increasing pressure.",
        ],
        diagram: "pneumatic-reject-circuit",
      };
    }
    return {
      ...genericPage(pneumatic, page, "VF-02 pneumatic drawing pack"),
      heading: `Pneumatic services and actuators - Sheet ${page}`,
    };
  },
};

const faultGuideSections: DocumentSection[] = [
  { page: 1, label: "Guide scope" },
  { page: 3, label: "Safety and evidence capture" },
  { page: 6, label: "Fault F-204" },
  { page: 10, label: "Fault F-207" },
  { page: 12, label: "Fault Tree 2 - False rejects" },
  { page: 16, label: "Escalation and verification" },
];

const faultGuide: DemoDocumentDefinition = {
  reference: "TSG-VF02-REJECT",
  title: "VF-02 Reject Station Fault-Finding Guide",
  documentType: "Fault-Finding Guide",
  revision: "Rev B",
  pageCount: 20,
  controlledStatus: "Demo controlled guide",
  sections: faultGuideSections,
  getPage(pageNumber) {
    const page = clampPage(pageNumber, 20);
    if (page === 12) {
      return {
        pageNumber: page,
        eyebrow: "Fault Tree 2 · False rejects",
        heading: "Intermittent reject confirmation investigation",
        paragraphs: [
          "Use this fault tree when the machine rejects acceptable containers or records intermittent confirmation faults without a consistent mechanical jam.",
        ],
        bullets: [
          "Inspect lens contamination and reflective target condition.",
          "Check sensor alignment and switching-distance margin.",
          "Flex-test the M12 cable while monitoring PLC input I3.7.",
          "Verify pneumatic cylinder reaches the confirmation position within 220 ms.",
          "Only after physical checks, compare PLC timing with the approved baseline.",
        ],
        diagram: "reject-fault-tree",
      };
    }
    if (page === 6) {
      return {
        pageNumber: page,
        eyebrow: "Fault F-204",
        heading: "Reject confirmation not received",
        table: {
          headers: ["Likely cause", "Evidence", "Next check"],
          rows: [
            ["Contaminated sensor", "Weak/intermittent LED", "Clean lens and challenge"],
            ["Cable fault", "Input changes during flex", "Inspect M12 and cable"],
            ["Slow cylinder", "Late physical movement", "Check pressure and exhaust"],
            ["PLC input path", "Sensor output healthy, I3.7 absent", "Use EL-204 sheet 7"],
          ],
        },
      };
    }
    return genericPage(faultGuide, page, "VF-02 reject fault-finding guide");
  },
};

const pmSections: DocumentSection[] = [
  { page: 1, label: "Task scope and isolation" },
  { page: 2, label: "Inspection preparation" },
  { page: 3, label: "Mechanical inspection" },
  { page: 4, label: "Sensor cleaning and alignment" },
  { page: 5, label: "Task 4 - Functional test" },
  { page: 7, label: "Close-out and records" },
];

const pmInstruction: DemoDocumentDefinition = {
  reference: "PM-VF02-30D",
  title: "VF-02 30-Day Inspection and Functional Test",
  documentType: "PM Instruction",
  revision: "Rev C",
  pageCount: 8,
  controlledStatus: "Demo controlled instruction",
  sections: pmSections,
  getPage(pageNumber) {
    const page = clampPage(pageNumber, 8);
    if (page === 5) {
      return {
        pageNumber: page,
        eyebrow: "Task 4 · Reject system functional test",
        heading: "Challenge-test acceptance criteria",
        paragraphs: [
          "After safe isolation checks and sensor cleaning, perform three controlled reject challenges using the approved test container. Record each response time and confirmation result.",
        ],
        table: {
          headers: ["Challenge", "Acceptance", "Record"],
          rows: [
            ["1", "Confirmation 80-220 ms", "Response time / pass-fail"],
            ["2", "Container diverted completely", "Visual confirmation"],
            ["3", "Alarm clears after healthy reset", "F-204/F-207 status"],
          ],
        },
        warning:
          "A failed challenge requires an open corrective work order. Do not close the PM as complete.",
        diagram: "pm-functional-test",
      };
    }
    return genericPage(pmInstruction, page, "VF-02 30-day PM instruction");
  },
};

const calibrationSections: DocumentSection[] = [
  { page: 1, label: "Certificate and traceability" },
  { page: 2, label: "Method and standards" },
  { page: 3, label: "Results and acceptance" },
  { page: 5, label: "As-left condition" },
];

const calibration: DemoDocumentDefinition = {
  reference: "CAL-VF02-RS-2026-06",
  title: "VF-02 Reject Sensor Verification Record",
  documentType: "Calibration Record",
  revision: "Rev 1",
  pageCount: 6,
  controlledStatus: "Demo calibration evidence",
  sections: calibrationSections,
  getPage(pageNumber) {
    const page = clampPage(pageNumber, 6);
    if (page === 3) {
      return {
        pageNumber: page,
        eyebrow: "Results and acceptance",
        heading: "Reject confirmation sensor verification",
        paragraphs: [
          "The sensor met the defined switching-distance tolerance. The lower-limit reading was sensitive to visible contamination, supporting a maintenance recommendation to clean the lens and verify margin during the next PM.",
        ],
        table: {
          headers: ["Test point", "Nominal", "Measured", "Result"],
          rows: [
            ["Clean target", "4.0 mm", "4.1 mm", "Pass"],
            ["Lower limit", "3.5 mm minimum", "3.6 mm", "Pass - low margin"],
            ["Repeatability", "±0.2 mm", "±0.1 mm", "Pass"],
            ["Contaminated lens", "Information only", "Intermittent at 3.6 mm", "Action noted"],
          ],
        },
        diagram: "calibration-result",
      };
    }
    return genericPage(calibration, page, "VF-02 reject sensor verification record");
  },
};

const definitions: Record<string, DemoDocumentDefinition> = {
  [manual.reference]: manual,
  [electrical.reference]: electrical,
  [pneumatic.reference]: pneumatic,
  [faultGuide.reference]: faultGuide,
  [pmInstruction.reference]: pmInstruction,
  [calibration.reference]: calibration,
};

function candidateReferences(document: EquipmentDocument): string[] {
  return [
    document.externalReference,
    document.drawingNumber,
    document.fileId?.replace(/\.pdf$/i, ""),
    document.name,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim());
}

export function getDemoDocumentDefinition(
  document: EquipmentDocument,
): DemoDocumentDefinition | null {
  for (const candidate of candidateReferences(document)) {
    const exact = definitions[candidate];
    if (exact) return exact;
    const normalised = candidate.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const match = Object.entries(definitions).find(([reference]) =>
      normalised.includes(reference.replace(/[^A-Z0-9-]/g, "")),
    );
    if (match) return match[1];
  }
  return null;
}
