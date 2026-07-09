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

type VortaAiRole =
  | "maintenance-manager"
  | "planner"
  | "engineer"
  | "operator"
  | "production-manager"
  | "contractor";

type GlobalAiIntent =
  | "daily-priority"
  | "site-risk"
  | "area-risk"
  | "equipment-risk"
  | "evidence"
  | "labour-risk"
  | "pm-risk"
  | "spares-risk"
  | "skills-risk"
  | "general";

interface RoleResponseProfile {
  role: VortaAiRole;
  label: string;
  subtitle: string;
  responseBadge: string;
  introAnswer: string;
  defaultAction: string;
  promptPlaceholder: string;
  contextLine: string;
  confidenceLabel: string;
  focusAreas: string[];
  quickQuestions: string[];
}

interface GlobalAiPromptEventDetail {
  question?: string;
  submit?: boolean;
  role?: VortaAiRole;
}

interface GlobalAiAnswer {
  directAnswer: string;
  evidence: string[];
  recommendedActions: string[];
  sources: string[];
  confidence: number;
  roleLabel: string;
  responseBadge: string;
  intentLabel: string;
  roleNote?: string;
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

// ─── Role profiles ────────────────────────────────────────────────────────────

const ROLE_PROFILES: Record<VortaAiRole, RoleResponseProfile> = {
  "maintenance-manager": {
    role: "maintenance-manager",
    label: "Maintenance Manager",
    subtitle: "Site risk and action assistant",
    responseBadge: "Strategic maintenance response",
    introAnswer: "I can answer Maintenance Manager questions using Vorta site risk, area risk, equipment risk and source document data currently available in the MVP.",
    defaultAction: "Ask: What should I review first today?",
    promptPlaceholder: "Ask about site risk, areas, equipment, evidence...",
    contextLine: "Using site risk, area risk, equipment risk and source documents.",
    confidenceLabel: "Manager confidence",
    focusAreas: ["site risk", "area risk", "equipment priority", "labour risk", "PM backlog", "skills coverage", "spares"],
    quickQuestions: [
      "What should I review first today?",
      "What is the highest site risk?",
      "Which area needs attention?",
      "Which equipment is most critical?",
      "What evidence supports this?",
    ],
  },
  planner: {
    role: "planner",
    label: "Maintenance Planner",
    subtitle: "Planning, workload and readiness assistant",
    responseBadge: "Planner response",
    introAnswer: "I can help a Maintenance Planner prioritise workload, prepare work packs, check PM readiness and highlight labour, spares or access constraints.",
    defaultAction: "Ask: What work should be planned first?",
    promptPlaceholder: "Ask about workload, PMs, spares, access, readiness...",
    contextLine: "Using equipment risk, PM backlog, area risk and source documents.",
    confidenceLabel: "Planning confidence",
    focusAreas: ["workload", "PM readiness", "spares", "access", "shutdown windows", "resource cover"],
    quickQuestions: [
      "What work should be planned first?",
      "Which PMs need spares before release?",
      "What is blocking readiness?",
      "Which asset should be scheduled first?",
      "What evidence supports this plan?",
    ],
  },
  engineer: {
    role: "engineer",
    label: "Engineer",
    subtitle: "Fault, evidence and safe action assistant",
    responseBadge: "Engineer response",
    introAnswer: "I can help an Engineer understand the likely fault, evidence, source sections, spares and safe next checks for assigned equipment.",
    defaultAction: "Ask: What should I check first?",
    promptPlaceholder: "Ask about faults, manuals, spares, PMs or safe checks...",
    contextLine: "Using equipment risk, work orders, manuals, SOPs, spares and source documents.",
    confidenceLabel: "Diagnostic confidence",
    focusAreas: ["fault checks", "safe isolation", "manuals", "SOPs", "spares", "work order history"],
    quickQuestions: [
      "What should I check first?",
      "What does the SOP say?",
      "What spares may be needed?",
      "Has this fault happened before?",
      "Who else has worked on this asset?",
    ],
  },
  operator: {
    role: "operator",
    label: "Operator",
    subtitle: "Safe task and escalation assistant",
    responseBadge: "Operator response",
    introAnswer: "I can help an Operator understand safe checks, escalation triggers, SOP references and what information to give maintenance.",
    defaultAction: "Ask: Is this safe to continue running?",
    promptPlaceholder: "Ask about safe checks, escalation, SOPs or task guidance...",
    contextLine: "Using SOPs, safe operating notes, equipment status and source documents.",
    confidenceLabel: "Operational confidence",
    focusAreas: ["safe running", "operator checks", "handover notes", "SOPs", "escalation"],
    quickQuestions: [
      "Is this safe to continue running?",
      "What should I tell maintenance?",
      "What operator checks are allowed?",
      "When should I escalate?",
      "What SOP applies?",
    ],
  },
  "production-manager": {
    role: "production-manager",
    label: "Production Manager",
    subtitle: "Production risk and impact assistant",
    responseBadge: "Production response",
    introAnswer: "I can help a Production Manager understand production impact, line risk, downtime exposure and what maintenance action affects output.",
    defaultAction: "Ask: What is the production impact today?",
    promptPlaceholder: "Ask about production impact, downtime, lines, risk or priorities...",
    contextLine: "Using site risk, equipment criticality, downtime and source documents.",
    confidenceLabel: "Production confidence",
    focusAreas: ["production impact", "line risk", "downtime", "critical assets", "handover actions"],
    quickQuestions: [
      "What is the production impact today?",
      "Which line is most at risk?",
      "What could stop production?",
      "What should I raise in the meeting?",
      "What is the evidence?",
    ],
  },
  contractor: {
    role: "contractor",
    label: "Contractor",
    subtitle: "Assignment and compliance assistant",
    responseBadge: "Contractor response",
    introAnswer: "I can help a Contractor understand assignment scope, required skills, compliance checks, source documents and handover expectations.",
    defaultAction: "Ask: What do I need before attending site?",
    promptPlaceholder: "Ask about assignment scope, compliance, skills or documents...",
    contextLine: "Using assignment context, equipment risk, compliance and source documents.",
    confidenceLabel: "Assignment confidence",
    focusAreas: ["assignment scope", "site compliance", "required skills", "documents", "handover"],
    quickQuestions: [
      "What do I need before attending site?",
      "What documents should I review?",
      "What skills are required?",
      "What risks should I know?",
      "What should my job report include?",
    ],
  },
};

function getRoleProfile(role: VortaAiRole): RoleResponseProfile {
  return ROLE_PROFILES[role] ?? ROLE_PROFILES["maintenance-manager"];
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

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

// ─── Intent classification ────────────────────────────────────────────────────

function classifyGlobalQuestion(question: string): GlobalAiIntent {
  const q = question.toLowerCase();

  if (
    q.includes("first") ||
    q.includes("today") ||
    q.includes("review") ||
    q.includes("priority") ||
    q.includes("worry")
  ) {
    return "daily-priority";
  }

  if (
    q.includes("site risk") ||
    q.includes("highest site") ||
    q.includes("overall risk") ||
    q.includes("site")
  ) {
    return "site-risk";
  }

  if (
    q.includes("building") ||
    q.includes("area") ||
    q.includes("line") ||
    q.includes("department")
  ) {
    return "area-risk";
  }

  if (
    q.includes("equipment") ||
    q.includes("asset") ||
    q.includes("machine") ||
    q.includes("critical") ||
    q.includes("next shift")
  ) {
    return "equipment-risk";
  }

  if (
    q.includes("evidence") ||
    q.includes("source") ||
    q.includes("why") ||
    q.includes("document") ||
    q.includes("manual") ||
    q.includes("sop")
  ) {
    return "evidence";
  }

  if (
    q.includes("labour") ||
    q.includes("labor") ||
    q.includes("cover") ||
    q.includes("shift") ||
    q.includes("engineer")
  ) {
    return "labour-risk";
  }

  if (
    q.includes("pm") ||
    q.includes("planned maintenance") ||
    q.includes("overdue") ||
    q.includes("backlog")
  ) {
    return "pm-risk";
  }

  if (
    q.includes("spare") ||
    q.includes("part") ||
    q.includes("stock") ||
    q.includes("bom")
  ) {
    return "spares-risk";
  }

  if (
    q.includes("skill") ||
    q.includes("training") ||
    q.includes("competency") ||
    q.includes("competence")
  ) {
    return "skills-risk";
  }

  return "general";
}

function findMentionedArea(question: string, areaRisks: AreaRiskProfile[]): AreaRiskProfile | undefined {
  const q = question.toLowerCase();

  return areaRisks.find((area) => {
    const areaName = area.area.toLowerCase();
    return q.includes(areaName) || areaName.split(/[\s/-]+/).some((part) => part.length > 2 && q.includes(part));
  });
}

function findMentionedEquipment(question: string, equipment: EquipmentListItem[]): EquipmentListItem | undefined {
  const q = question.toLowerCase();

  return equipment.find((item) => {
    const name = item.name.toLowerCase();
    const assetNumber = item.assetNumber?.toLowerCase?.() ?? "";

    return (
      q.includes(name) ||
      Boolean(assetNumber && q.includes(assetNumber)) ||
      name.split(/[\s/-]+/).some((part) => part.length > 3 && q.includes(part))
    );
  });
}

function getIntentTitle(intent: GlobalAiIntent): string {
  switch (intent) {
    case "daily-priority":   return "Daily priority";
    case "site-risk":        return "Site risk";
    case "area-risk":        return "Area risk";
    case "equipment-risk":   return "Equipment risk";
    case "evidence":         return "Evidence summary";
    case "labour-risk":      return "Labour risk";
    case "pm-risk":          return "PM risk";
    case "spares-risk":      return "Spares risk";
    case "skills-risk":      return "Skills risk";
    default:                 return "General risk question";
  }
}

// ─── Role-aware helpers ───────────────────────────────────────────────────────

function roleAwareDirectAnswer(
  baseAnswer: string,
  roleProfile: RoleResponseProfile,
  topEquipment?: EquipmentListItem,
): string {
  const equipmentName = topEquipment?.name ?? "the highest-risk asset";

  switch (roleProfile.role) {
    case "planner":
      return `${baseAnswer} Planning lens: confirm the work can be scheduled by checking labour availability, required spares, access constraints, PM status and any source document requirements before releasing work.`;
    case "engineer":
      return `${baseAnswer} Engineering lens: start with safe isolation requirements, source-backed checks, previous work order evidence and likely spares before touching the asset.`;
    case "operator":
      return `${baseAnswer} Operator lens: do not perform maintenance activity. Capture the alarm/state, follow the approved SOP, complete only permitted operator checks and escalate ${equipmentName} to maintenance if risk remains.`;
    case "production-manager":
      return `${baseAnswer} Production lens: focus on production impact, line availability, likely downtime exposure and what decision is needed before the next shift or production meeting.`;
    case "contractor":
      return `${baseAnswer} Contractor lens: confirm assignment scope, site access, compliance documents, required skills, isolation handover and job report expectations before attending.`;
    case "maintenance-manager":
    default:
      return `${baseAnswer} Maintenance Manager lens: prioritise risk reduction, labour coverage, PM backlog, skills gaps, spares and the action owner.`;
  }
}

function roleAwareActions(
  baseActions: string[],
  roleProfile: RoleResponseProfile,
  topEquipment?: EquipmentListItem,
): string[] {
  const equipmentName = topEquipment?.name ?? "the highest-risk asset";

  const roleActions: Record<VortaAiRole, string[]> = {
    "maintenance-manager": [
      `Assign an owner to review ${equipmentName} risk drivers and confirm the next action.`,
      "Check labour cover, skills coverage, overdue PMs and critical spares before the next handover.",
    ],
    planner: [
      `Create or review the work pack for ${equipmentName}.`,
      "Check spares, permits, access, estimated duration and engineer availability before scheduling.",
    ],
    engineer: [
      `Open the equipment detail for ${equipmentName} and review source-backed checks before attending.`,
      "Confirm isolation/SOP requirements and record evidence before resetting or replacing parts.",
    ],
    operator: [
      "Follow the approved SOP and complete only permitted operator checks.",
      `Escalate ${equipmentName} to maintenance with alarm text, time, product/state and any safe observations.`,
    ],
    "production-manager": [
      `Review the production impact of ${equipmentName} and agree risk tolerance before the next shift.`,
      "Raise the risk in the production/maintenance meeting with the evidence summary.",
    ],
    contractor: [
      `Confirm scope, compliance, RAMS/permit requirements and site access before attending ${equipmentName}.`,
      "Review the linked source documents and prepare a clear job report with findings and actions.",
    ],
  };

  return unique([...roleActions[roleProfile.role], ...baseActions]).slice(0, 5);
}

function roleAwareNote(roleProfile: RoleResponseProfile): string {
  switch (roleProfile.role) {
    case "operator":
      return "Operator safety note: this does not authorise maintenance work. Follow site SOPs and escalate outside permitted checks.";
    case "contractor":
      return "Contractor note: confirm assignment, permit, RAMS and site access requirements before attending.";
    case "engineer":
      return "Engineer safety note: confirm isolation and approved procedure before physical intervention.";
    case "planner":
      return "Planner note: this supports planning priority, not final release without labour, spares, access and permit checks.";
    case "production-manager":
      return "Production note: this supports production risk decisions, not maintenance override decisions.";
    case "maintenance-manager":
    default:
      return "Manager note: this supports prioritisation and action ownership using available Vorta evidence.";
  }
}

// ─── Answer engine ────────────────────────────────────────────────────────────

function buildGlobalAnswer(
  question: string,
  siteRisk: SiteRiskProfile | null,
  areaRisks: AreaRiskProfile[],
  equipment: EquipmentListItem[],
  knowledgeChunks: EquipmentKnowledgeChunk[],
  roleProfile: RoleResponseProfile,
): GlobalAiAnswer {
  const intent = classifyGlobalQuestion(question);
  const mentionedArea = findMentionedArea(question, areaRisks);
  const mentionedEquipment = findMentionedEquipment(question, equipment);

  const sortedEquipment = [...equipment].sort((a, b) => {
    const scoreDiff = b.riskScore - a.riskScore;
    if (scoreDiff !== 0) return scoreDiff;
    return riskRank(b.riskLevel) - riskRank(a.riskLevel);
  });

  const sortedAreas = [...areaRisks].sort((a, b) => b.riskScore - a.riskScore);

  const topEquipment = sortedEquipment[0];
  const topArea = sortedAreas[0];

  const selectedArea = mentionedArea ?? topArea;
  const selectedEquipment = mentionedEquipment ?? topEquipment;

  const evidence: string[] = [];
  const recommendedActions: string[] = [];
  const sources: string[] = [];
  const missingData: string[] = [];
  let directAnswer = "";

  switch (intent) {
    case "daily-priority": {
      if (selectedEquipment) {
        directAnswer = `Review ${selectedEquipment.name} first. It is the highest-priority asset based on the current equipment risk list at ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`;
        evidence.push(`${selectedEquipment.name} is ranked highest in the equipment risk list.`);
        evidence.push(`Risk score: ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel}.`);
        if (selectedEquipment.area) evidence.push(`Area: ${selectedEquipment.area}.`);
        recommendedActions.push(`Open ${selectedEquipment.name} and check risk drivers, PMs, work orders, skills and spares.`);
        recommendedActions.push("Confirm action owner before the next shift handover.");
        sources.push("Equipment risk list");
      }
      if (siteRisk) {
        evidence.push(`Site risk is currently ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
        sources.push("Site risk profile");
      }
      if (!selectedEquipment && !siteRisk) {
        directAnswer = "I cannot identify today's priority because no equipment or site risk data is currently available.";
        missingData.push("Equipment risk list and site risk profile are unavailable.");
      }
      break;
    }

    case "site-risk": {
      if (siteRisk) {
        directAnswer = `The current site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}. ${siteRisk.highestArea ? `${siteRisk.highestArea} is currently the highest-risk area.` : ""}`;
        evidence.push(`Site risk score: ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
        if (siteRisk.highestArea) evidence.push(`Highest area: ${siteRisk.highestArea} at ${siteRisk.highestAreaScore ?? "unknown"}%.`);
        if (siteRisk.riskSummary) evidence.push(siteRisk.riskSummary);
        if (siteRisk.priorityAction) recommendedActions.push(siteRisk.priorityAction);
        sources.push("Site risk profile");
      } else {
        directAnswer = "I cannot confirm the current site risk because the site risk profile is unavailable.";
        missingData.push("Site risk profile is unavailable.");
      }
      break;
    }

    case "area-risk": {
      if (selectedArea) {
        directAnswer = `${selectedArea.area} is the area to review. It is currently ${selectedArea.riskScore}% ${selectedArea.riskLevel} risk.`;
        evidence.push(`${selectedArea.area} risk score: ${selectedArea.riskScore}% ${selectedArea.riskLevel}.`);
        evidence.push(`${selectedArea.criticalAssetCount} critical asset${selectedArea.criticalAssetCount === 1 ? "" : "s"} and ${selectedArea.highAssetCount} high-risk asset${selectedArea.highAssetCount === 1 ? "" : "s"} are linked to this area.`);
        if (selectedArea.riskSummary) evidence.push(selectedArea.riskSummary);
        if (selectedArea.priorityAction) recommendedActions.push(selectedArea.priorityAction);
        sources.push("Area risk profiles");
      } else {
        directAnswer = "I cannot identify the area risk because no area profile matched the question.";
        missingData.push("No matching area risk profile was found.");
      }
      break;
    }

    case "equipment-risk": {
      if (selectedEquipment) {
        directAnswer = `${selectedEquipment.name} needs the most attention from the current equipment risk list. It is ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`;
        evidence.push(`${selectedEquipment.name} risk score: ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel}.`);
        if (selectedEquipment.area) evidence.push(`Area: ${selectedEquipment.area}.`);
        if (selectedEquipment.status) evidence.push(`Status: ${selectedEquipment.status}.`);
        recommendedActions.push(`Open ${selectedEquipment.name} and review risk drivers, overdue PMs, work orders, skills coverage and spares.`);
        recommendedActions.push("Confirm whether action is required before the next shift handover.");
        sources.push("Equipment risk list");
      } else {
        directAnswer = "I cannot identify the highest-risk equipment because the equipment risk list is unavailable.";
        missingData.push("Equipment risk list is unavailable.");
      }
      break;
    }

    case "evidence": {
      if (knowledgeChunks.length > 0) {
        directAnswer = `I found ${knowledgeChunks.length} matched source section${knowledgeChunks.length === 1 ? "" : "s"}. The strongest source match is ${sourceLabel(knowledgeChunks[0])}.`;
        knowledgeChunks.slice(0, 4).forEach((chunk) => {
          evidence.push(
            `${chunk.documentType}: ${chunk.title}${chunk.revision ? ` Rev ${chunk.revision}` : ""}, ${chunk.chunkRef}${chunk.sectionTitle ? ` - ${chunk.sectionTitle}` : ""}: ${shorten(chunk.chunkText, 180)}`,
          );
        });
        sources.push(...knowledgeChunks.slice(0, 4).map(sourceLabel));
        recommendedActions.push("Open the linked equipment page and review the source sections before making the decision.");
      } else {
        directAnswer = "I can use current risk data, but I did not find matching manual, SOP, training or SAP source sections for this question.";
        missingData.push("No matching knowledge document chunks were returned.");
        if (siteRisk) evidence.push(`Site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
        if (selectedEquipment) evidence.push(`${selectedEquipment.name} is ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`);
        sources.push("Site/equipment risk data");
      }
      break;
    }

    case "labour-risk": {
      directAnswer = "Labour risk should be reviewed against shift cover, single-point skill exposure and engineer availability before the next handover.";
      if (siteRisk) evidence.push(`Site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
      if (selectedArea) evidence.push(`${selectedArea.area} is ${selectedArea.riskScore}% ${selectedArea.riskLevel} risk.`);
      if (selectedEquipment) evidence.push(`${selectedEquipment.name} should be checked for skills coverage and single-point dependency.`);
      recommendedActions.push("Check shift coverage and critical skill availability for the highest-risk area.");
      recommendedActions.push("Confirm whether contractor fallback or reallocation is needed.");
      sources.push("Site risk profile", "Area risk profiles", "Equipment risk list");
      break;
    }

    case "pm-risk": {
      directAnswer = "PM risk should be reviewed by checking overdue PMs, readiness, labour availability and whether the work can be completed before risk increases.";
      if (selectedEquipment) evidence.push(`${selectedEquipment.name} is the priority asset for PM/readiness review at ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`);
      if (siteRisk) evidence.push(`Site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
      recommendedActions.push("Open the equipment PM tab and check overdue PMs, next due date and readiness.");
      recommendedActions.push("Confirm spares, labour, access and permit requirements before scheduling.");
      sources.push("Equipment risk list", "Site risk profile");
      break;
    }

    case "spares-risk": {
      directAnswer = "Spares risk should be reviewed against the highest-risk equipment and any critical component availability gaps.";
      if (selectedEquipment) evidence.push(`${selectedEquipment.name} is the priority asset to check for spare availability.`);
      recommendedActions.push("Open the equipment spares tab and check critical parts, stock status and lead time.");
      recommendedActions.push("Escalate any zero-stock critical spare linked to a high-risk asset.");
      sources.push("Equipment risk list", "Equipment spares data");
      break;
    }

    case "skills-risk": {
      directAnswer = "Skills risk should be reviewed by checking whether the highest-risk equipment has enough competent engineers and no single-point dependency.";
      if (selectedEquipment) evidence.push(`${selectedEquipment.name} should be checked for validated skill coverage.`);
      if (selectedArea) evidence.push(`${selectedArea.area} is ${selectedArea.riskScore}% ${selectedArea.riskLevel} risk.`);
      recommendedActions.push("Open the equipment skills tab and check validated engineer coverage.");
      recommendedActions.push("Create training or contractor fallback actions for any single-point skill gaps.");
      sources.push("Equipment risk list", "Skills coverage data");
      break;
    }

    default: {
      directAnswer = "I can answer that using the current site, area, equipment and source document data, but the question does not match a specific risk category yet.";
      if (siteRisk) evidence.push(`Site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
      if (selectedArea) evidence.push(`${selectedArea.area} is ${selectedArea.riskScore}% ${selectedArea.riskLevel} risk.`);
      if (selectedEquipment) evidence.push(`${selectedEquipment.name} is ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`);
      recommendedActions.push("Ask about site risk, area risk, equipment risk, PMs, spares, skills or evidence for a more specific answer.");
      sources.push("Site risk profile", "Area risk profiles", "Equipment risk list");
      break;
    }
  }

  if (!directAnswer) {
    directAnswer = "I could not build a specific answer from the current Vorta data.";
    missingData.push("No matching risk context was available for this question.");
  }

  const roleAwareAnswer = roleAwareDirectAnswer(directAnswer, roleProfile, selectedEquipment);
  const roleActions = roleAwareActions(recommendedActions, roleProfile, selectedEquipment);

  const dataPoints = [siteRisk, selectedArea, selectedEquipment, knowledgeChunks.length > 0].filter(Boolean).length;

  return {
    directAnswer: roleAwareAnswer,
    evidence: unique(evidence),
    recommendedActions: roleActions,
    sources: unique(sources),
    confidence: Math.min(92, Math.max(55, 55 + dataPoints * 8)),
    roleLabel: roleProfile.label,
    responseBadge: roleProfile.responseBadge,
    intentLabel: getIntentTitle(intent),
    roleNote: roleAwareNote(roleProfile),
    knowledgeChunks,
    missingData: unique(missingData),
  };
}

// ─── AnswerBlock ──────────────────────────────────────────────────────────────

function AnswerBlock({ answer }: { answer: GlobalAiAnswer }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="h-auto rounded bg-blue-500/15 px-1.5 py-0 text-[9px] font-bold text-blue-300 shadow-none">
          {answer.responseBadge}
        </Badge>
        <Badge className="h-auto rounded bg-gray-800 px-1.5 py-0 text-[9px] font-medium text-slate-400 shadow-none">
          {answer.roleLabel}
        </Badge>
        <Badge className="h-auto rounded bg-gray-800/80 px-1.5 py-0 text-[9px] font-medium text-slate-500 shadow-none">
          {answer.intentLabel}
        </Badge>
      </div>

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

      {answer.roleNote && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1.5">
          <p className="text-[10px] leading-relaxed text-blue-100/80">{answer.roleNote}</p>
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
          Role-aware source-backed response
        </span>
        <span className="font-semibold text-blue-400">{answer.confidence}% confidence</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GlobalMaintenanceAiAssistantProps {
  role?: VortaAiRole;
}

export function GlobalMaintenanceAiAssistant({
  role = "maintenance-manager",
}: GlobalMaintenanceAiAssistantProps): JSX.Element {
  const roleProfile = getRoleProfile(role);

  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [input, setInput] = useState("");
  const [siteRisk, setSiteRisk] = useState<SiteRiskProfile | null>(null);
  const [areaRisks, setAreaRisks] = useState<AreaRiskProfile[]>([]);
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [messages, setMessages] = useState<GlobalAiMessage[]>([
    {
      id: "global-mm-intro",
      role: "assistant",
      answer: {
        directAnswer: roleProfile.introAnswer,
        evidence: [],
        recommendedActions: [roleProfile.defaultAction],
        sources: [],
        confidence: 70,
        roleLabel: roleProfile.label,
        responseBadge: roleProfile.responseBadge,
        intentLabel: "Introduction",
        roleNote: roleAwareNote(roleProfile),
      },
    },
  ]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setLoadingContext(true);
    setContextReady(false);

    Promise.all([getSiteRiskProfile(), getAreaRiskProfiles(), getEquipmentList()])
      .then(([nextSiteRisk, nextAreaRisks, nextEquipment]) => {
        if (!mounted) return;
        setSiteRisk(nextSiteRisk);
        setAreaRisks(nextAreaRisks);
        setEquipment(nextEquipment);
        setLoadingContext(false);
        setContextReady(true);
      })
      .catch((error) => {
        console.warn("GlobalMaintenanceAiAssistant context load failed:", error);
        if (mounted) {
          setLoadingContext(false);
          setContextReady(true);
        }
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

    const intent = classifyGlobalQuestion(trimmed);
    const mentionedAsset = findMentionedEquipment(trimmed, equipment);
    const topAsset = mentionedAsset ?? [...equipment].sort((a, b) => b.riskScore - a.riskScore)[0];

    const knowledgeQuery =
      intent === "evidence" || intent === "equipment-risk" || intent === "pm-risk" || intent === "spares-risk" || intent === "skills-risk"
        ? `${trimmed} ${topAsset?.name ?? ""} ${topAsset?.assetNumber ?? ""}`.trim()
        : trimmed;

    const [knowledgeChunks] = await Promise.all([
      searchEquipmentKnowledge(topAsset?.id ?? "fl-03", knowledgeQuery, 5),
      new Promise((resolve) => window.setTimeout(resolve, 700)),
    ]);

    const answer = buildGlobalAnswer(trimmed, siteRisk, areaRisks, equipment, knowledgeChunks, roleProfile);

    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId ? { ...message, loading: false, answer } : message,
      ),
    );
  };

  useEffect(() => {
    const handlePromptEvent = (event: Event) => {
      const detail = (event as CustomEvent<GlobalAiPromptEventDetail>).detail;
      const question = detail?.question?.trim() ?? "";

      setOpen(true);
      setMinimised(false);

      // Role override is accepted in the event detail for future portal-specific assistants.
      if (detail?.role && detail.role !== roleProfile.role) {
        console.warn("GlobalMaintenanceAiAssistant received a prompt for a different role. Current role:", roleProfile.role, "Requested role:", detail.role);
      }

      if (!question) return;

      if (detail?.submit) {
        setPendingPrompt(question);
        setInput("");
      } else {
        setInput(question);
      }
    };

    window.addEventListener("vorta-global-ai-prompt", handlePromptEvent);

    return () => {
      window.removeEventListener("vorta-global-ai-prompt", handlePromptEvent);
    };
  }, []);

  useEffect(() => {
    if (!open || !contextReady || !pendingPrompt) return;

    const question = pendingPrompt;
    setPendingPrompt("");

    void submitQuestion(question);
  }, [open, contextReady, pendingPrompt]);

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
            <p className="text-[10px] text-slate-500">{roleProfile.subtitle}</p>
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
              {roleProfile.quickQuestions.map((question) => (
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
                  {roleProfile.contextLine}
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
              placeholder={roleProfile.promptPlaceholder}
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
