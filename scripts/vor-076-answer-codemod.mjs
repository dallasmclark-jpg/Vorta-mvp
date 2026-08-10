import { readFileSync, writeFileSync } from "node:fs";

const path = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
let source = readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Missing VOR-076 anchor: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  `import {\n  prepareAskVortaImage,\n  type PreparedAskVortaImage,\n} from "./askVortaImageClient";`,
  `import {\n  getAskVortaImagePreview,\n  prepareAskVortaImage,\n  type PreparedAskVortaImage,\n} from "./askVortaImageClient";`,
  "image preview import",
);
replaceOnce(
  `  const hasStructuredActions = Boolean(answer.actionPlan?.length);\n  const workspacePresentation = presentation === "workspace";\n  const wideCompactPresentation =`,
  `  const hasStructuredActions = Boolean(answer.actionPlan?.length);\n  const workspacePresentation = presentation === "workspace";\n  const sparePhotoIdentification = answer.intentLabel === "Spare photo identification";\n  const wideCompactPresentation =`,
  "spare response flag",
);
replaceOnce(
  `  const decisionSummaryLimit = wideCompactPresentation ? 4 : 7;`,
  `  const decisionSummaryLimit = sparePhotoIdentification ? 5 : wideCompactPresentation ? 4 : 7;`,
  "top five summary limit",
);
replaceOnce(
  `            <span>Decision summary</span>`,
  `            <span>{sparePhotoIdentification ? "Closest stock matches" : "Decision summary"}</span>`,
  "closest stock heading",
);
replaceOnce(
  `      <details className="group rounded-lg border border-emerald-500/15 bg-emerald-500/[0.03]">`,
  `      {(hasStructuredActions || answer.recommendedActions.length > 0) && (\n      <details className="group rounded-lg border border-emerald-500/15 bg-emerald-500/[0.03]">`,
  "empty risk-plan guard start",
);
replaceOnce(
  `      </details>\n\n      {answer.followUpQuestions && answer.followUpQuestions.length > 0 && (`,
  `      </details>\n      )}\n\n      {answer.followUpQuestions && answer.followUpQuestions.length > 0 && (`,
  "empty risk-plan guard end",
);
replaceOnce(
  `            intentLabel: agentAnswer.intentLabel,\n            roleNote: roleAwareNote(roleProfile),`,
  `            intentLabel: agentAnswer.intentLabel,\n            roleNote:\n              agentAnswer.intentLabel === "Spare photo identification"\n                ? undefined\n                : roleAwareNote(roleProfile),`,
  "spare manager-note suppression",
);
replaceOnce(
  `                      {message.imageName ? (\n                        <p className="hidden text-xs font-semibold text-blue-100/80 md:block">\n                          Photo attached: {message.imageName}\n                        </p>\n                      ) : null}`,
  `                      {message.imageName && getAskVortaImagePreview(message.imageName) ? (\n                        <img\n                          src={getAskVortaImagePreview(message.imageName) ?? undefined}\n                          alt="Submitted maintenance photo"\n                          className="hidden max-h-28 w-auto max-w-full rounded-lg border border-gray-800 bg-gray-950 object-contain md:block"\n                        />\n                      ) : message.imageName ? (\n                        <p className="hidden text-xs font-semibold text-blue-100/80 md:block">\n                          Photo attached: {message.imageName}\n                        </p>\n                      ) : null}`,
  "compact submitted image",
);

writeFileSync(path, source);
