import { useEffect, useState } from "react";
import { Bot, ChevronDown, Loader2, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  getAreaRiskProfiles,
  getEquipmentList,
  getSiteRiskProfile,
  searchEquipmentKnowledge,
  type AreaRiskProfile,
  type EquipmentKnowledgeChunk,
  type EquipmentListItem,
  type SiteRiskProfile,
} from "../Equipment/equipmentService";

type ChatRole = "user" | "assistant";

interface GlobalAiAnswer {
  directAnswer: string;
  evidence: string[];
  recommendedActions: string[];
  sources: string[];
  confidence: number;
  knowledgeChunks?: EquipmentKnowledgeChunk[];
  missingData?: string[];
}

interface GlobalAiMessage {
  id: string;
  role: ChatRole;
  text?: string;
  loading?: boolean;
  answer?: GlobalAiAnswer;
}

const GLOBAL_QUESTIONS = [
  "What should I review first today?",
  "What is the highest site risk?",
  "Which area needs attention?",
  "Which equipment is most critical?",
  "What evidence supports this?",
];

function shorten(text: string, max = 240): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function riskRank(level: string): number {
  const value = level.toLowerCase();
  if (value.includes("critical")) return 4;
  if (value.includes("high")) return 3;
  if (value.includes("medium")) return 2;
  if (value.includes("low")) return 1;
  return 0;
}

function sourceLabel(chunk: EquipmentKnowledgeChunk): string {
  const revision = chunk.revision ? ` Rev ${chunk.revision}` : "";
  const section = chunk.sectionTitle ? `${chunk.chunkRef} ${chunk.sectionTitle}` : chunk.chunkRef;
  return `${chunk.sourceSystem}: ${chunk.title}${revision}, ${section}`;
}

function buildGlobalAnswer(
  question: string,
  siteRisk: SiteRiskProfile | null,
  areaRisks: AreaRiskProfile[],
  equipment: EquipmentListItem[],
  knowledgeChunks: EquipmentKnowledgeChunk[],
): GlobalAiAnswer {
  const q = question.toLowerCase();

  const sortedEquipment = [...equipment].sort((a, b) => {
    const scoreDiff = b.riskScore - a.riskScore;
    if (scoreDiff !== 0) return scoreDiff;
    return riskRank(b.riskLevel) - riskRank(a.riskLevel);
  });

  const sortedAreas = [...areaRisks].sort((a, b) => b.riskScore - a.riskScore);

  const topEquipment = sortedEquipment[0];
  const topArea = sortedAreas[0];

  const evidence: string[] = [];
  const recommendedActions: string[] = [];
  const sources: string[] = [];
  const missingData: string[] = [];

  if (siteRisk) {
    evidence.push(`Current site risk score is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
    if (siteRisk.highestArea) {
      evidence.push(`Highest area is ${siteRisk.highestArea} at ${siteRisk.highestAreaScore ?? "unknown"}%.`);
    }
    if (siteRisk.riskSummary) evidence.push(siteRisk.riskSummary);
    if (siteRisk.priorityAction) recommendedActions.push(siteRisk.priorityAction);
    sources.push("Site risk profile");
  } else {
    missingData.push("Site risk profile is not available.");
  }

  if (topArea) {
    evidence.push(`${topArea.area} is the highest-ranked area at ${topArea.riskScore}% ${topArea.riskLevel} risk.`);
    if (topArea.riskSummary) evidence.push(topArea.riskSummary);
    if (topArea.priorityAction) recommendedActions.push(topArea.priorityAction);
    sources.push("Area risk profiles");
  } else {
    missingData.push("Area risk profiles are not available.");
  }

  if (topEquipment) {
    evidence.push(`${topEquipment.name} is the highest-ranked equipment item at ${topEquipment.riskScore}% ${topEquipment.riskLevel} risk.`);
    recommendedActions.push(`Open ${topEquipment.name} and review its risk drivers, overdue PMs, work orders, skills coverage and spares.`);
    sources.push("Equipment risk list");
  } else {
    missingData.push("Equipment risk list is not available.");
  }

  if (knowledgeChunks.length > 0) {
    evidence.push(`Knowledge search found ${knowledgeChunks.length} matching source section${knowledgeChunks.length === 1 ? "" : "s"}.`);
    knowledgeChunks.slice(0, 3).forEach((chunk) => {
      evidence.push(
        `${chunk.documentType}: ${chunk.title}${chunk.revision ? ` Rev ${chunk.revision}` : ""}, ${chunk.chunkRef}${chunk.sectionTitle ? ` - ${chunk.sectionTitle}` : ""}: ${shorten(chunk.chunkText, 180)}`,
      );
    });
    sources.push(...knowledgeChunks.slice(0, 4).map(sourceLabel));
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push("Review the dashboard risk summary, then open the highest-risk equipment item for source-backed detail.");
  }

  let directAnswer = "The highest-priority maintenance management action is to review the live site risk profile, then drill into the highest-risk area and asset.";

  if (q.includes("first") || q.includes("today") || q.includes("priority")) {
    directAnswer = topEquipment
      ? `Review ${topEquipment.name} first. It is currently the highest-ranked equipment risk at ${topEquipment.riskScore}% ${topEquipment.riskLevel}. Start with its risk drivers, overdue PMs, work orders, skills coverage and spares.`
      : "Start with the site risk profile and highest-risk area. I cannot name a specific asset because the equipment risk list is unavailable.";
  }

  if (q.includes("site risk") || q.includes("highest site")) {
    directAnswer = siteRisk
      ? `The current site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}. ${siteRisk.highestArea ? `${siteRisk.highestArea} is the highest-risk area at ${siteRisk.highestAreaScore ?? "unknown"}%.` : "No highest area is currently available."}`
      : "I cannot confirm the current site risk because the site risk profile is unavailable.";
  }

  if (q.includes("area")) {
    directAnswer = topArea
      ? `${topArea.area} needs the most attention. It is currently ${topArea.riskScore}% ${topArea.riskLevel} risk, with ${topArea.criticalAssetCount} critical asset${topArea.criticalAssetCount === 1 ? "" : "s"} and ${topArea.highAssetCount} high-risk asset${topArea.highAssetCount === 1 ? "" : "s"}.`
      : "I cannot identify the highest-risk area because area risk data is unavailable.";
  }

  if (q.includes("equipment") || q.includes("asset") || q.includes("critical")) {
    directAnswer = topEquipment
      ? `${topEquipment.name} is currently the highest-ranked equipment item at ${topEquipment.riskScore}% ${topEquipment.riskLevel} risk in ${topEquipment.area}.`
      : "I cannot identify the highest-risk equipment because the equipment risk list is unavailable.";
  }

  if (q.includes("evidence") || q.includes("source") || q.includes("document") || q.includes("manual") || q.includes("sop")) {
    directAnswer = knowledgeChunks.length > 0
      ? `I found source-backed evidence from ${knowledgeChunks.length} matched knowledge section${knowledgeChunks.length === 1 ? "" : "s"}. The strongest match is ${sourceLabel(knowledgeChunks[0])}.`
      : "I can use site, area and equipment risk data, but I did not find matching manual/SOP/training/SAP source sections for this question.";
  }

  return {
    directAnswer,
    evidence: unique(evidence),
    recommendedActions: unique(recommendedActions),
    sources: unique(sources),
    confidence: Math.min(92, Math.max(55, 55 + [siteRisk, topArea, topEquipment, knowledgeChunks.length > 0].filter(Boolean).length * 8)),
    knowledgeChunks,
    missingData: unique(missingData),
  };
}

function AnswerBlock({ answer }: { answer: GlobalAiAnswer }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] leading-relaxed text-slate-200">{answer.directAnswer}</p>

      <div>
        <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Evidence</h4>
        <ul className="flex flex-col gap-1">
          {answer.evidence.slice(0, 6).map((item) => (
            <li key={item} className="flex gap-2 text-[10px] leading-relaxed text-slate-400">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommended action</h4>
        <ul className="flex flex-col gap-1">
          {answer.recommendedActions.slice(0, 4).map((item) => (
            <li key={item} className="flex gap-2 text-[10px] leading-relaxed text-slate-300">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {answer.sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {answer.sources.slice(0, 6).map((source) => (
            <Badge
              key={source}
              className="h-auto rounded border border-gray-700 bg-gray-800/70 px-1.5 py-0 text-[9px] font-medium text-slate-300 shadow-none"
            >
              {source}
            </Badge>
          ))}
        </div>
      )}

      {answer.missingData && answer.missingData.length > 0 && (
        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-1.5">
          {answer.missingData.map((item) => (
            <p key={item} className="text-[10px] leading-relaxed text-yellow-100/80">
              {item}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-800 pt-2 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          Site-level source-backed response
        </span>
        <span className="font-semibold text-blue-400">{answer.confidence}% confidence</span>
      </div>
    </div>
  );
}

export function GlobalMaintenanceAiAssistant(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [input, setInput] = useState("");
  const [siteRisk, setSiteRisk] = useState<SiteRiskProfile | null>(null);
  const [areaRisks, setAreaRisks] = useState<AreaRiskProfile[]>([]);
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [messages, setMessages] = useState<GlobalAiMessage[]>([
    {
      id: "global-mm-intro",
      role: "assistant",
      answer: {
        directAnswer:
          "I can answer site-level Maintenance Manager questions using Vorta risk, area, equipment and source document data currently available in the MVP.",
        evidence: [],
        recommendedActions: ["Ask: What should I review first today?"],
        sources: [],
        confidence: 70,
      },
    },
  ]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setLoadingContext(true);

    Promise.all([getSiteRiskProfile(), getAreaRiskProfiles(), getEquipmentList()])
      .then(([nextSiteRisk, nextAreaRisks, nextEquipment]) => {
        if (!mounted) return;
        setSiteRisk(nextSiteRisk);
        setAreaRisks(nextAreaRisks);
        setEquipment(nextEquipment);
        setLoadingContext(false);
      })
      .catch((error) => {
        console.warn("GlobalMaintenanceAiAssistant context load failed:", error);
        if (mounted) setLoadingContext(false);
      });

    return () => {
      mounted = false;
    };
  }, [open]);

  const submitQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const userId = `global-user-${Date.now()}`;
    const assistantId = `global-assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: trimmed },
      { id: assistantId, role: "assistant", loading: true },
    ]);

    setInput("");

    const topAsset = [...equipment].sort((a, b) => b.riskScore - a.riskScore)[0];
    const knowledgeQuery = `${trimmed} ${topAsset?.name ?? ""} ${topAsset?.assetNumber ?? ""}`.trim();

    const [knowledgeChunks] = await Promise.all([
      searchEquipmentKnowledge(topAsset?.id ?? "fl-03", knowledgeQuery, 5),
      new Promise((resolve) => window.setTimeout(resolve, 700)),
    ]);

    const answer = buildGlobalAnswer(trimmed, siteRisk, areaRisks, equipment, knowledgeChunks);

    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId ? { ...message, loading: false, answer } : message,
      ),
    );
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMinimised(false);
        }}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-xl shadow-blue-950/40 transition-colors hover:bg-blue-500"
      >
        <Bot className="h-4 w-4" />
        Ask Vorta AI
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-blue-500/20 bg-[#10141d] shadow-2xl shadow-black/60">
      <div className="flex items-center justify-between border-b border-gray-800 bg-[#141820] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
            <Sparkles className="h-4 w-4 text-blue-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Vorta AI</h3>
            <p className="text-[10px] text-slate-500">Maintenance Manager assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimised((value) => !value)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Minimise global assistant"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${minimised ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Close global assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          <div className="border-b border-gray-800 px-4 py-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {GLOBAL_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => submitQuestion(question)}
                  className="rounded-full border border-gray-700 bg-[#0f1218] px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                >
                  {question}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              {loadingContext ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                  Loading site context...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  Using site risk, area risk, equipment risk and source documents.
                </>
              )}
            </div>
          </div>

          <div className="flex max-h-[380px] flex-col gap-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-lg px-3 py-2 ${message.role === "user" ? "bg-blue-600 text-white" : "border border-gray-800 bg-gray-900/70 text-slate-200"}`}
                >
                  {message.loading ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                      Analysing site risk, area risk, equipment and source data...
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

          <div className="flex gap-2 border-t border-gray-800 px-4 py-3">
            <input
              type="text"
              placeholder="Ask about site risk, areas, equipment, evidence..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitQuestion(input)}
              className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-[#0f1218] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
            />

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
        </>
      )}
    </div>
  );
}
