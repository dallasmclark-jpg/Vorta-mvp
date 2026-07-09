import { useState } from "react";
import { Brain, FileText, Loader2, Send, ShieldCheck } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  searchEquipmentKnowledge,
  type EquipmentKnowledgeChunk,
  type EquipmentSummary,
} from "./equipmentService";

type ChatRole = "user" | "assistant";

interface AssistantAnswer {
  directAnswer: string;
  evidence: string[];
  recommendedActions: string[];
  sources: string[];
  missingData: string[];
  confidence: number;
  demoNote?: string;
  knowledgeChunks?: EquipmentKnowledgeChunk[];
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  text?: string;
  answer?: AssistantAnswer;
  loading?: boolean;
}

interface EquipmentKnowledgeAssistantProps {
  equipmentId: string;
  summary: EquipmentSummary | null;
}

const SUGGESTED_QUESTIONS = [
  "What should we check first for an infeed sensor fault?",
  "What does the SOP say before restart?",
  "What happened last time this fault occurred?",
  "Who is trained on this equipment?",
  "What manual sections are relevant?",
];

function sameEquipmentId(value: string | null | undefined, equipmentId: string, resolvedId: string): boolean {
  return Boolean(value && (value === equipmentId || value === resolvedId));
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function listJoin(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function shortenText(text: string, maxLength = 280): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function formatKnowledgeSource(chunk: EquipmentKnowledgeChunk): string {
  const revision = chunk.revision ? ` Rev ${chunk.revision}` : "";
  const section = chunk.sectionTitle
    ? `${chunk.chunkRef} ${chunk.sectionTitle}`
    : chunk.chunkRef;
  return `${chunk.sourceSystem}: ${chunk.title}${revision}, section ${section}`;
}

function buildKnowledgeDirectAnswer(
  question: string,
  equipmentName: string,
  knowledgeChunks: EquipmentKnowledgeChunk[],
): string | null {
  if (knowledgeChunks.length === 0) return null;

  const q = question.toLowerCase();
  const top = knowledgeChunks[0];
  const topThree = knowledgeChunks.slice(0, 3);

  if (
    q.includes("check first") ||
    q.includes("what should") ||
    q.includes("fault") ||
    q.includes("sensor") ||
    q.includes("infeed") ||
    q.includes("breakdown")
  ) {
    const checks = topThree.map((chunk) => {
      const section = chunk.sectionTitle ? `${chunk.chunkRef} ${chunk.sectionTitle}` : chunk.chunkRef;
      return `${chunk.title} ${section}: ${shortenText(chunk.chunkText, 170)}`;
    });

    return `For ${equipmentName}, the first checks should be based on the highest matching approved source sections. ${checks.join(" ")} These checks are source-backed, not generic AI advice.`;
  }

  if (
    q.includes("manual") ||
    q.includes("sop") ||
    q.includes("instruction") ||
    q.includes("document")
  ) {
    return `I found ${knowledgeChunks.length} relevant approved source section${knowledgeChunks.length === 1 ? "" : "s"} for ${equipmentName}. The strongest match is ${top.title}${top.revision ? ` Rev ${top.revision}` : ""}, section ${top.chunkRef}${top.sectionTitle ? ` - ${top.sectionTitle}` : ""}. It states: ${shortenText(top.chunkText, 320)}`;
  }

  if (
    q.includes("training") ||
    q.includes("trained") ||
    q.includes("competency") ||
    q.includes("competent")
  ) {
    return `The most relevant training/competency evidence for ${equipmentName} is from ${top.title}. ${shortenText(top.chunkText, 320)}`;
  }

  return `The most relevant approved knowledge source for ${equipmentName} is ${top.title}${top.revision ? ` Rev ${top.revision}` : ""}, section ${top.chunkRef}${top.sectionTitle ? ` - ${top.sectionTitle}` : ""}. It states: ${shortenText(top.chunkText, 320)}`;
}

function generateEquipmentAnswer(
  question: string,
  equipmentId: string,
  summary: EquipmentSummary | null,
  knowledgeChunks: EquipmentKnowledgeChunk[] = [],
): AssistantAnswer {
  if (!summary) {
    return {
      directAnswer: "I cannot complete the analysis yet because the equipment data has not finished loading. The assistant needs the equipment summary before it can give a source-backed answer.",
      evidence: [],
      recommendedActions: ["Wait for the equipment summary to load, then ask the question again."],
      sources: [],
      missingData: ["Equipment summary is not loaded."],
      confidence: 20,
      knowledgeChunks,
    };
  }

  const equipment = summary.equipment;
  const resolvedId = equipment.id;
  const q = question.toLowerCase();

  const openOrders = summary.workOrders.open.filter((wo) => sameEquipmentId(wo.equipmentId, equipmentId, resolvedId));
  const completedOrders = summary.workOrders.completed.filter((wo) => sameEquipmentId(wo.equipmentId, equipmentId, resolvedId));
  const pms = summary.pms.filter((pm) => sameEquipmentId(pm.equipmentId, equipmentId, resolvedId));
  const documents = summary.documents.filter((doc) => sameEquipmentId(doc.equipmentId, equipmentId, resolvedId));
  const activity = summary.activity.filter((item) => sameEquipmentId(item.equipmentId, equipmentId, resolvedId));
  const aiInsights = summary.aiInsights.filter((item) => sameEquipmentId(item.equipmentId, equipmentId, resolvedId));

  const structuredSkills = summary.skills.skills;
  const legacySkills = summary.skills.legacySkills.filter((skill) => sameEquipmentId(skill.equipmentId, equipmentId, resolvedId));

  const topRiskFactors = [...equipment.riskBreakdown].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const overdueOrders = openOrders.filter((wo) => wo.overdue);
  const highPriorityOrders = openOrders.filter((wo) => wo.priority === "CRITICAL" || wo.priority === "HIGH");
  const overduePms = pms.filter((pm) => pm.status === "OVERDUE");
  const dueSoonPms = pms.filter((pm) => pm.status === "DUE SOON");

  const pmCompliance =
    pms.length > 0
      ? Math.round(pms.reduce((sum, pm) => sum + pm.compliance, 0) / pms.length)
      : null;

  const missingStructuredSkills = structuredSkills.filter((skill) => skill.coverage === "red");
  const amberStructuredSkills = structuredSkills.filter((skill) => skill.coverage === "amber");
  const missingLegacySkills = legacySkills.filter((skill) => !skill.covered);

  const topEngineers =
    summary.skills.engineers.length > 0
      ? summary.skills.engineers.slice(0, 3).map((engineer) => `${engineer.name} (${engineer.matchPercent}% match, ${engineer.availability})`)
      : legacySkills.length > 0
        ? summary.skills.legacyEngineers.slice(0, 3).map((engineer) => `${engineer.name} (${engineer.match}% match, ${engineer.status})`)
        : [];

  const criticalComponents = summary.components.criticalComponents;

  const manualLikeDocuments = documents.filter((doc) =>
    /manual|sop|procedure|instruction|work instruction/i.test(`${doc.name} ${doc.category}`),
  );

  const evidence: string[] = [];
  const recommendedActions: string[] = [];
  const sources: string[] = [];
  const missingData: string[] = [];

  // ── Knowledge chunks go first ─────────────────────────────────────────────
  const knowledgeDirectAnswer = buildKnowledgeDirectAnswer(question, equipment.name, knowledgeChunks);

  if (knowledgeChunks.length > 0) {
    evidence.push(
      `Knowledge search found ${knowledgeChunks.length} approved source section${knowledgeChunks.length === 1 ? "" : "s"} from manuals, SOPs, work instructions, training records or SAP history.`,
    );
    knowledgeChunks.slice(0, 4).forEach((chunk) => {
      evidence.push(
        `${chunk.documentType}: ${chunk.title}${chunk.revision ? ` Rev ${chunk.revision}` : ""}, section ${chunk.chunkRef}${chunk.sectionTitle ? ` - ${chunk.sectionTitle}` : ""}: ${shortenText(chunk.chunkText, 220)}`,
      );
    });
    sources.push(...knowledgeChunks.slice(0, 6).map(formatKnowledgeSource));
  } else {
    missingData.push("No matching EasyDoc demo manual, SOP, work instruction, iLearn training record or SAP PM history chunk was found for this exact question.");
  }

  // ── Structured data evidence ──────────────────────────────────────────────
  evidence.push(`${equipment.name} is currently scored at ${equipment.riskScore}% ${equipment.riskLevel} risk.`);
  sources.push("Equipment profile");
  sources.push("Equipment risk breakdown");

  if (topRiskFactors.length > 0) {
    evidence.push(`Top risk drivers are ${topRiskFactors.map((factor) => `${factor.label} ${factor.pct}%`).join(", ")}.`);
  }

  if (openOrders.length > 0) {
    evidence.push(`${openOrders.length} open work order${openOrders.length === 1 ? "" : "s"} found, including ${highPriorityOrders.length} high/critical priority item${highPriorityOrders.length === 1 ? "" : "s"}.`);
    sources.push("Open work orders");
  } else {
    missingData.push("No open work order records were found for this asset.");
  }

  if (completedOrders.length > 0 || activity.length > 0) {
    const latestActivity = activity[0];
    evidence.push(
      latestActivity
        ? `Latest history item: ${latestActivity.woNumber} - ${latestActivity.description}.`
        : `${completedOrders.length} completed work order${completedOrders.length === 1 ? "" : "s"} found.`,
    );
    sources.push("Work order history");
  } else {
    missingData.push("No completed work order or breakdown history was found for this asset.");
  }

  if (pms.length > 0) {
    evidence.push(`PM compliance is ${pmCompliance ?? 0}%, with ${overduePms.length} overdue PM${overduePms.length === 1 ? "" : "s"} and ${dueSoonPms.length} due soon.`);
    sources.push("Preventive maintenance schedule");
  } else {
    missingData.push("No PM schedule records were found for this asset.");
  }

  if (structuredSkills.length > 0) {
    evidence.push(`Skills coverage shows ${summary.skills.coverageSummary.coveragePercent}% coverage, with ${missingStructuredSkills.length} missing skill${missingStructuredSkills.length === 1 ? "" : "s"} and ${amberStructuredSkills.length} at-risk skill${amberStructuredSkills.length === 1 ? "" : "s"}.`);
    sources.push("Equipment skills matrix");
  } else if (legacySkills.length > 0) {
    evidence.push(`Skills register shows ${legacySkills.length - missingLegacySkills.length}/${legacySkills.length} required skills covered.`);
    sources.push("Equipment skills matrix");
  } else {
    missingData.push("No validated equipment skill coverage was found for this asset.");
  }

  if (criticalComponents.length > 0) {
    evidence.push(`${criticalComponents.length} critical spare/component issue${criticalComponents.length === 1 ? "" : "s"} found: ${criticalComponents.slice(0, 3).map((component) => `${component.name} (${component.status})`).join(", ")}.`);
    sources.push("Spares / BOM components");
  } else if (summary.components.inventory.length > 0) {
    evidence.push(`${summary.components.inventory.length} spare/component records are linked to this asset.`);
    sources.push("Spares / BOM components");
  } else {
    missingData.push("No spares or BOM component records were found for this asset.");
  }

  if (documents.length > 0) {
    evidence.push(`Document register contains ${documents.length} document${documents.length === 1 ? "" : "s"}: ${documents.slice(0, 4).map((doc) => `${doc.name} (${doc.category})`).join(", ")}.`);
    sources.push("Equipment document register");
    if (manualLikeDocuments.length === 0) {
      missingData.push("No manual, SOP or work instruction is currently tagged for this asset.");
    } else {
      missingData.push("Manual/SOP full-text search uses the knowledge chunk index. Individual document record listing is from the equipment document register.");
    }
  } else {
    missingData.push("No manuals, SOPs, work instructions or equipment documents are currently uploaded for this asset.");
  }

  if (aiInsights.length > 0) {
    evidence.push(`Existing AI insights include: ${aiInsights.slice(0, 3).map((insight) => `${insight.title} (${insight.confidence}% confidence)`).join(", ")}.`);
    sources.push("Existing AI insights");
  }

  if (overduePms.length > 0) {
    recommendedActions.push(`Plan and complete overdue PMs first: ${overduePms.slice(0, 3).map((pm) => pm.name).join(", ")}.`);
  }

  if (overdueOrders.length > 0) {
    recommendedActions.push(`Review overdue work orders: ${overdueOrders.slice(0, 3).map((wo) => wo.id).join(", ")}.`);
  } else if (highPriorityOrders.length > 0) {
    recommendedActions.push(`Review high/critical work orders: ${highPriorityOrders.slice(0, 3).map((wo) => wo.id).join(", ")}.`);
  }

  if (missingStructuredSkills.length > 0) {
    recommendedActions.push(`Close missing skills coverage for: ${missingStructuredSkills.slice(0, 3).map((skill) => skill.name).join(", ")}.`);
  } else if (missingLegacySkills.length > 0) {
    recommendedActions.push(`Close missing skills coverage for: ${missingLegacySkills.slice(0, 3).map((skill) => skill.name).join(", ")}.`);
  }

  if (criticalComponents.length > 0) {
    recommendedActions.push(`Check spare availability for: ${criticalComponents.slice(0, 3).map((component) => component.name).join(", ")}.`);
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push("Continue monitoring risk drivers and refresh the equipment data after the next SAP/CMMS import.");
  }

  // ── Per-intent branches ───────────────────────────────────────────────────

  if (q.includes("document") || q.includes("manual") || q.includes("sop") || q.includes("instruction")) {
    const directAnswer =
      knowledgeDirectAnswer ??
      (documents.length === 0
        ? `No manuals, SOPs, work instructions or equipment documents are currently uploaded for ${equipment.name}. I can still answer from the equipment profile, PMs, work orders, skills and spares data that is available.`
        : `The document register for ${equipment.name} contains ${documents.length} document${documents.length === 1 ? "" : "s"}: ${documents.map((doc) => doc.name).join(", ")}. No matching full-text demo knowledge chunk was found for this specific question.`);

    return {
      directAnswer,
      evidence,
      recommendedActions: documents.length === 0 && knowledgeChunks.length === 0
        ? ["Upload the OEM manual, SOPs and work instructions, then link them to this asset."]
        : recommendedActions,
      sources: unique(sources),
      missingData: unique(missingData),
      confidence: knowledgeChunks.length > 0 ? 88 : documents.length > 0 ? 74 : 58,
      demoNote: equipment.id === "pl-02" ? "Some source data may be demo data for the MVP." : undefined,
      knowledgeChunks,
    };
  }

  if (q.includes("trained") || q.includes("skill") || q.includes("engineer") || q.includes("who") || q.includes("training") || q.includes("competency") || q.includes("competent")) {
    const directAnswer =
      knowledgeDirectAnswer ??
      (topEngineers.length > 0
        ? `The best available engineer matches for ${equipment.name} are ${listJoin(topEngineers, "not currently available")}. Skills risk should still be checked against the required skill coverage before assigning work.`
        : `No validated engineer coverage was found for ${equipment.name}. That means Vorta cannot safely recommend a named engineer from the current data.`);

    return {
      directAnswer,
      evidence,
      recommendedActions,
      sources: unique(sources),
      missingData: unique(missingData),
      confidence: knowledgeChunks.length > 0 ? 85 : topEngineers.length > 0 ? 78 : 52,
      demoNote: equipment.id === "pl-02" ? "Some source data may be demo data for the MVP." : undefined,
      knowledgeChunks,
    };
  }

  if (q.includes("pm") || q.includes("preventive") || q.includes("overdue")) {
    const directAnswer =
      pms.length > 0
        ? `${equipment.name} has ${pms.length} PM record${pms.length === 1 ? "" : "s"}. The key issue is ${overduePms.length > 0 ? `${overduePms.length} overdue PM${overduePms.length === 1 ? "" : "s"}` : "no overdue PMs in the current PM data"}, with overall PM compliance at ${pmCompliance ?? 0}%.`
        : `No PM schedule records were found for ${equipment.name}, so I cannot confirm overdue PMs from current data.`;

    return {
      directAnswer,
      evidence,
      recommendedActions,
      sources: unique(sources),
      missingData: unique(missingData),
      confidence: knowledgeChunks.length > 0 ? 88 : pms.length > 0 ? 82 : 48,
      demoNote: equipment.id === "pl-02" ? "Some source data may be demo data for the MVP." : undefined,
      knowledgeChunks,
    };
  }

  if (q.includes("spare") || q.includes("part") || q.includes("bom") || q.includes("stock")) {
    const directAnswer =
      summary.components.inventory.length > 0
        ? `${equipment.name} has ${summary.components.inventory.length} linked component/spare record${summary.components.inventory.length === 1 ? "" : "s"}. The main spares concern is ${criticalComponents.length > 0 ? `${criticalComponents.length} critical availability issue${criticalComponents.length === 1 ? "" : "s"}` : "no critical spare availability issue in the current component data"}.`
        : `No spares or BOM component records were found for ${equipment.name}.`;

    return {
      directAnswer,
      evidence,
      recommendedActions,
      sources: unique(sources),
      missingData: unique(missingData),
      confidence: knowledgeChunks.length > 0 ? 85 : summary.components.inventory.length > 0 ? 80 : 45,
      demoNote: equipment.id === "pl-02" ? "Some source data may be demo data for the MVP." : undefined,
      knowledgeChunks,
    };
  }

  if (q.includes("history") || q.includes("last time") || q.includes("fault") || q.includes("breakdown") || q.includes("sensor") || q.includes("infeed") || q.includes("check first") || q.includes("what should")) {
    const directAnswer =
      knowledgeDirectAnswer ??
      (activity.length > 0
        ? `The available history for ${equipment.name} shows ${activity.length} recent activity record${activity.length === 1 ? "" : "s"}. The latest recorded item is ${activity[0].woNumber}: ${activity[0].description}.`
        : `No breakdown or work order history was found for ${equipment.name}, so I cannot identify a repeat fault pattern from current records.`);

    return {
      directAnswer,
      evidence,
      recommendedActions,
      sources: unique(sources),
      missingData: unique(missingData),
      confidence: knowledgeChunks.length > 0 ? 88 : activity.length > 0 ? 80 : 46,
      demoNote: equipment.id === "pl-02" ? "Some source data may be demo data for the MVP." : undefined,
      knowledgeChunks,
    };
  }

  const directAnswer =
    knowledgeDirectAnswer ??
    (`${equipment.name} is currently ${equipment.riskLevel.toLowerCase()} risk at ${equipment.riskScore}%. ` +
    `The strongest evidence points to ${topRiskFactors.length > 0 ? listJoin(topRiskFactors.map((factor) => factor.label), "the current risk profile") : "the current risk profile"}, supported by the available PM, work order, skills and spares data. ` +
    `The next action should be: ${recommendedActions[0]}`);

  const evidenceScore = [
    topRiskFactors.length > 0,
    openOrders.length > 0,
    pms.length > 0,
    structuredSkills.length > 0 || legacySkills.length > 0,
    summary.components.inventory.length > 0,
    documents.length > 0,
    activity.length > 0,
    aiInsights.length > 0,
    knowledgeChunks.length > 0,
  ].filter(Boolean).length;

  return {
    directAnswer,
    evidence,
    recommendedActions,
    sources: unique(sources),
    missingData: unique(missingData),
    confidence: Math.min(92, Math.max(55, 45 + evidenceScore * 6)),
    demoNote: equipment.id === "pl-02" ? "Some source data may be demo data for the MVP." : undefined,
    knowledgeChunks,
  };
}

function AnswerBlock({ answer }: { answer: AssistantAnswer }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] leading-relaxed text-slate-200">{answer.directAnswer}</p>

      {answer.demoNote && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[10px] text-blue-300">
          {answer.demoNote}
        </div>
      )}

      <div>
        <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Evidence used</h4>
        <ul className="flex flex-col gap-1">
          {answer.evidence.length > 0 ? (
            answer.evidence.map((item) => (
              <li key={item} className="flex gap-2 text-[10px] leading-relaxed text-slate-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                {item}
              </li>
            ))
          ) : (
            <li className="text-[10px] text-slate-500">No evidence available yet.</li>
          )}
        </ul>
      </div>

      <div>
        <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommended action</h4>
        <ul className="flex flex-col gap-1">
          {answer.recommendedActions.map((item) => (
            <li key={item} className="flex gap-2 text-[10px] leading-relaxed text-slate-300">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {answer.sources.map((source) => (
          <Badge key={source} className="h-auto rounded border border-gray-700 bg-gray-800/70 px-2 py-0.5 text-[9px] font-medium text-slate-300 shadow-none">
            {source}
          </Badge>
        ))}
      </div>

      {answer.knowledgeChunks && answer.knowledgeChunks.length > 0 && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-300">
            Source sections
          </h4>
          <div className="flex flex-col gap-2">
            {answer.knowledgeChunks.slice(0, 4).map((chunk) => (
              <div key={chunk.chunkId} className="rounded border border-blue-500/10 bg-[#0f1218] px-2.5 py-2">
                <p className="text-[10px] font-semibold text-blue-200">
                  {chunk.sourceSystem}: {chunk.title}
                  {chunk.revision ? ` Rev ${chunk.revision}` : ""} · {chunk.chunkRef}
                  {chunk.sectionTitle ? ` · ${chunk.sectionTitle}` : ""}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                  {shortenText(chunk.chunkText, 260)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {answer.missingData.length > 0 && (
        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
          <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-yellow-400">Missing data / limits</h4>
          <ul className="flex flex-col gap-1">
            {answer.missingData.map((item) => (
              <li key={item} className="text-[10px] leading-relaxed text-yellow-100/80">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-800 pt-2 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          Source-backed response
        </span>
        <span className="font-semibold text-blue-400">{answer.confidence}% confidence</span>
      </div>
    </div>
  );
}

export function EquipmentKnowledgeAssistant({ equipmentId, summary }: EquipmentKnowledgeAssistantProps): JSX.Element {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-intro",
      role: "assistant",
      answer: {
        directAnswer: "Ask me about this asset's risk, PMs, work order history, skills coverage, spares or available documents. I will answer only from the Vorta data currently available for this equipment.",
        evidence: [],
        recommendedActions: ["Ask a question such as: Why is this asset high risk?"],
        sources: summary ? ["Equipment summary"] : [],
        missingData: summary ? [] : ["Equipment data is still loading."],
        confidence: summary ? 70 : 25,
      },
    },
  ]);

  const submitQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: trimmed },
      { id: assistantId, role: "assistant", loading: true },
    ]);

    setInput("");

    const [knowledgeChunks] = await Promise.all([
      searchEquipmentKnowledge(equipmentId, trimmed, 8),
      new Promise((resolve) => window.setTimeout(resolve, 900)),
    ]);

    const answer = generateEquipmentAnswer(trimmed, equipmentId, summary, knowledgeChunks as EquipmentKnowledgeChunk[]);

    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId ? { ...message, loading: false, answer } : message,
      ),
    );
  };

  return (
    <Card className="rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-200">Equipment AI Assistant</h3>
        </div>

        <p className="mb-3 text-[11px] text-slate-500">
          Answers from equipment data, PMs, work orders, skills, spares, EasyDoc demo manuals, SOPs, work instructions, iLearn demo training records and SAP PM demo history.
        </p>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => submitQuestion(question)}
              className="rounded-full border border-gray-700 bg-[#0f1218] px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300"
            >
              {question}
            </button>
          ))}
        </div>

        <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-lg bg-[#0f1218] p-3">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] rounded-lg px-3 py-2 ${message.role === "user" ? "bg-blue-600 text-white" : "border border-gray-800 bg-gray-900/70 text-slate-200"}`}>
                {message.loading ? (
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                    Searching equipment data, EasyDoc demo documents, SAP PM history and iLearn training records...
                  </div>
                ) : message.answer ? (
                  <AnswerBlock answer={message.answer} />
                ) : (
                  <p className="text-[11px] leading-relaxed">{message.text}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <FileText className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Ask about risk, PMs, history, skills, spares or documents..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitQuestion(input)}
              className="w-full rounded-lg border border-gray-700 bg-[#0f1218] py-2 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
            />
          </div>

          <Button
            type="button"
            onClick={() => submitQuestion(input)}
            disabled={!input.trim()}
            className="h-8 shrink-0 gap-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
