import { readFileSync, writeFileSync } from "node:fs";

const assistantPath = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
let source = readFileSync(assistantPath, "utf8");
let changed = false;

const answerStart = source.indexOf("const answer: GlobalAiAnswer = {");
if (answerStart < 0) {
  throw new Error("VOR-051 could not locate the Ask Vorta agent answer mapping.");
}
const answerEnd = source.indexOf("          };", answerStart);
if (answerEnd < 0) {
  throw new Error("VOR-051 could not locate the end of the Ask Vorta agent answer mapping.");
}

const answerBlock = source.slice(answerStart, answerEnd);
if (!answerBlock.includes("evidenceLinks: agentAnswer.evidenceLinks,")) {
  const confidenceMarker = "            confidence: agentAnswer.confidence,\n";
  const confidenceIndex = source.indexOf(confidenceMarker, answerStart);
  if (confidenceIndex < 0 || confidenceIndex > answerEnd) {
    throw new Error("VOR-051 could not restore evidence links in the agent answer mapping.");
  }
  const insertionIndex = confidenceIndex + confidenceMarker.length;
  source =
    source.slice(0, insertionIndex) +
    "            evidenceLinks: agentAnswer.evidenceLinks,\n" +
    source.slice(insertionIndex);
  changed = true;
}

if (!source.includes("Open in Vorta")) {
  const sourcesMarker = "      {answer.sources.length > 0 && (\n";
  const sourcesIndex = source.indexOf(sourcesMarker);
  if (sourcesIndex < 0) {
    throw new Error("VOR-051 could not locate the Ask Vorta source badges insertion point.");
  }

  const evidenceLinksRenderer = `      {answer.evidenceLinks && answer.evidenceLinks.length > 0 && (
        <div data-vorta-ai-evidence-links="true">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Open in Vorta
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {answer.evidenceLinks.slice(0, 8).map((link) => (
              <button
                type="button"
                key={link.recordType + "-" + link.path}
                data-vorta-ai-evidence-link={link.recordType}
                onClick={() => navigate(link.path)}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/25 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-200 transition-colors hover:border-blue-400/50 hover:bg-blue-500/15"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </button>
            ))}
          </div>
        </div>
      )}

`;

  source =
    source.slice(0, sourcesIndex) +
    evidenceLinksRenderer +
    source.slice(sourcesIndex);
  changed = true;
}

for (const marker of [
  "evidenceLinks?: VortaAgentEvidenceLink[];",
  "evidenceLinks: agentAnswer.evidenceLinks,",
  "answer.evidenceLinks && answer.evidenceLinks.length > 0",
  "Open in Vorta",
]) {
  if (!source.includes(marker)) {
    throw new Error(`VOR-051 evidence-link integration is incomplete: ${marker}`);
  }
}

if (changed) {
  writeFileSync(assistantPath, source);
  console.log("Applied VOR-051 Ask Vorta evidence-link preservation.");
} else {
  console.log("VOR-051 Ask Vorta evidence-link preservation is already applied.");
}
