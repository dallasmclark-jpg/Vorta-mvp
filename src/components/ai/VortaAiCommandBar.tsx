import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  ClipboardPaste,
  FileText,
  Image as ImageIcon,
  Plus,
  Send,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import {
  getEquipmentList,
  type EquipmentListItem,
} from "../../screens/Equipment/equipmentService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VortaAiRole =
  | "maintenance-manager"
  | "planner"
  | "engineer"
  | "operator"
  | "production-manager"
  | "contractor";

export interface VortaAiCommandBarProps {
  role: VortaAiRole;
  title?: string;
  description?: string;
  placeholder?: string;
  prompts?: string[];
  enablePhotoUpload?: boolean;
  enableDocumentUpload?: boolean;
  enableHandoverNote?: boolean;
  enableSapExport?: boolean;
}

// ─── Role-specific defaults ───────────────────────────────────────────────────

const ROLE_COPY: Record<
  VortaAiRole,
  { description: string; placeholder: string; prompts: string[] }
> = {
  "maintenance-manager": {
    description:
      "Ask about today's site risk, labour cover, equipment, PMs, skills, spares or recommended actions.",
    placeholder: "Ask Vorta what needs attention today...",
    prompts: [
      "What should I review first today?",
      "Why is Building 2 high risk?",
      "Which asset needs action before the next shift?",
    ],
  },
  planner: {
    description:
      "Ask about PM readiness, workload, access, spares, labour cover and scheduling risk.",
    placeholder: "Ask Vorta what needs planning attention...",
    prompts: [
      "What work should be planned first?",
      "Which PMs need spares before release?",
      "What is blocking readiness?",
    ],
  },
  engineer: {
    description:
      "Ask about faults, SOPs, manuals, spares, previous work orders and safe next checks.",
    placeholder: "Ask Vorta what to check first...",
    prompts: [
      "What should I check first?",
      "What spares may be needed?",
      "Has this fault happened before?",
    ],
  },
  operator: {
    description:
      "Ask about safe checks, escalation triggers, handover notes and what to tell maintenance.",
    placeholder: "Ask Vorta what should be escalated...",
    prompts: [
      "Is this safe to continue running?",
      "What should I tell maintenance?",
      "When should I escalate?",
    ],
  },
  "production-manager": {
    description:
      "Ask about line risk, downtime exposure, production impact and maintenance priorities.",
    placeholder: "Ask Vorta what could affect production...",
    prompts: [
      "What is the production impact today?",
      "Which line is most at risk?",
      "What should I raise in the meeting?",
    ],
  },
  contractor: {
    description:
      "Ask about assignment scope, site compliance, required skills, documents and handover expectations.",
    placeholder: "Ask Vorta what is needed before attending site...",
    prompts: [
      "What do I need before attending site?",
      "What documents should I review?",
      "What should my job report include?",
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VortaAiCommandBar({
  role,
  title = "Ask Vorta anything",
  description,
  placeholder,
  prompts,
  enablePhotoUpload = true,
  enableDocumentUpload = true,
  enableHandoverNote = true,
  enableSapExport = true,
}: VortaAiCommandBarProps): JSX.Element {
  const navigate = useNavigate();

  const roleCopy = ROLE_COPY[role];
  const resolvedDescription = description ?? roleCopy.description;
  const resolvedPlaceholder = placeholder ?? roleCopy.placeholder;
  const resolvedPrompts = prompts ?? roleCopy.prompts;

  const [aiInput, setAiInput] = useState("");
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [equipmentList, setEquipmentList] = useState<EquipmentListItem[]>([]);
  const [isPhotoEquipmentPickerOpen, setIsPhotoEquipmentPickerOpen] = useState(false);
  const [isEquipmentSearchOpen, setIsEquipmentSearchOpen] = useState(false);
  const [equipmentSearchQuery, setEquipmentSearchQuery] = useState("");

  useEffect(() => {
    if (enablePhotoUpload) {
      getEquipmentList().then(setEquipmentList);
    }
  }, [enablePhotoUpload]);

  // ── Derived lists ──────────────────────────────────────────────────────────

  const topPhotoDiagnosticEquipment = [...equipmentList]
    .sort((a, b) => {
      const diff = b.riskScore - a.riskScore;
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  const searchedEquipment = equipmentList
    .filter((item) => {
      const q = equipmentSearchQuery.trim().toLowerCase();
      if (!q) return false;
      return (
        item.name.toLowerCase().includes(q) ||
        item.area?.toLowerCase().includes(q) ||
        item.assetNumber?.toLowerCase?.().includes(q) ||
        item.oem?.toLowerCase?.().includes(q) ||
        item.riskLevel?.toLowerCase?.().includes(q)
      );
    })
    .sort((a, b) => {
      const diff = b.riskScore - a.riskScore;
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  // ── Attachment actions config ──────────────────────────────────────────────

  const attachmentActions = [
    enablePhotoUpload && {
      label: "Upload photo",
      description: "HMI alarm, damaged part, nameplate or spare label",
      icon: ImageIcon,
      prompt: "photo-diagnostic-picker",
    },
    enableDocumentUpload && {
      label: "Upload document",
      description: "SOP, work instruction, report or PDF",
      icon: FileText,
      prompt: "I want to analyse a document and link it to site risk, equipment or actions.",
    },
    enableHandoverNote && {
      label: "Paste handover note",
      description: "Shift handover, fault note or meeting action",
      icon: ClipboardPaste,
      prompt: "I want to paste a shift handover note and identify risks, actions and owners.",
    },
    enableSapExport && {
      label: "Add SAP/export file",
      description: "SAP, skills, PM, spares or work order export",
      icon: Table2,
      prompt: "I want to add an SAP/export file and use it to update Vorta risk intelligence.",
    },
  ].filter(Boolean) as { label: string; description: string; icon: React.ElementType; prompt: string }[];

  // ── Helpers ────────────────────────────────────────────────────────────────

  const closeAllPanels = () => {
    setIsAttachmentMenuOpen(false);
    setIsPhotoEquipmentPickerOpen(false);
    setIsEquipmentSearchOpen(false);
    setEquipmentSearchQuery("");
  };

  const openPhotoEquipmentPicker = () => {
    setIsAttachmentMenuOpen(false);
    setIsPhotoEquipmentPickerOpen(true);
    setIsEquipmentSearchOpen(false);
    setEquipmentSearchQuery("");
  };

  const openVisualDiagnosticForEquipment = (equipmentId: string) => {
    closeAllPanels();
    setAiInput("");
    navigate(`/equipment/${equipmentId}/ai-insights?visualDiagnostic=upload`);
  };

  const fireGlobalAiPrompt = (question: string, submit: boolean) => {
    window.dispatchEvent(
      new CustomEvent("vorta-global-ai-prompt", {
        detail: { question, submit, role },
      }),
    );
  };

  const openGlobalAi = (question: string, submit = true) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    fireGlobalAiPrompt(trimmed, submit);
    closeAllPanels();
    setAiInput("");
  };

  const handleAttachmentAction = (prompt: string) => {
    if (prompt === "photo-diagnostic-picker") {
      openPhotoEquipmentPicker();
      return;
    }

    setAiInput(prompt);
    closeAllPanels();
    fireGlobalAiPrompt(prompt, false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card className="w-full rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">

          {/* Heading */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
              <Sparkles className="h-4 w-4 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
              <p className="text-[11px] text-slate-500">{resolvedDescription}</p>
            </div>
          </div>

          {/* Input row */}
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-[#0f1218] px-2 py-1.5 focus-within:border-blue-500/50">

              {/* Plus button + attachment dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAttachmentMenuOpen((v) => !v)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-blue-300"
                  aria-label="Add attachment or context"
                >
                  <Plus className="h-4 w-4" />
                </button>

                {isAttachmentMenuOpen && (
                  <div className="absolute left-0 top-10 z-30 w-72 overflow-hidden rounded-xl border border-gray-800 bg-[#10141d] shadow-2xl shadow-black/50">
                    <div className="border-b border-gray-800 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Add context
                      </p>
                    </div>

                    <div className="flex flex-col p-1.5">
                      {attachmentActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.label}
                            type="button"
                            onClick={() => handleAttachmentAction(action.prompt)}
                            className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-blue-500/10"
                          >
                            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-300">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-semibold text-slate-200">
                                {action.label}
                              </span>
                              <span className="block text-[10px] leading-relaxed text-slate-500">
                                {action.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-gray-800 px-3 py-2">
                      <p className="text-[9px] leading-relaxed text-slate-600">
                        Upload processing will be connected in the next phase. This prepares the workflow.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Text input */}
              <div className="relative min-w-0 flex-1">
                <Bot className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  value={aiInput}
                  onChange={(event) => setAiInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      openGlobalAi(aiInput, true);
                    }
                    if (event.key === "Escape") {
                      closeAllPanels();
                    }
                  }}
                  placeholder={resolvedPlaceholder}
                  className="w-full border-0 bg-transparent py-1.5 pl-7 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={() => openGlobalAi(aiInput, true)}
              disabled={!aiInput.trim()}
              className="h-auto gap-2 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Ask
            </Button>
          </div>

          {/* Photo equipment picker panel */}
          {isPhotoEquipmentPickerOpen && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-100">
                    Which equipment is the photo for?
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-blue-100/60">
                    Choose the asset first, then upload the HMI screenshot, part photo, nameplate or spare label in the Visual Diagnostic Assistant.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsPhotoEquipmentPickerOpen(false);
                    setIsEquipmentSearchOpen(false);
                    setEquipmentSearchQuery("");
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-100/60 transition-colors hover:bg-white/10 hover:text-blue-100"
                  aria-label="Close photo equipment picker"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {topPhotoDiagnosticEquipment.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {topPhotoDiagnosticEquipment.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openVisualDiagnosticForEquipment(item.id)}
                      className="rounded-lg border border-blue-500/20 bg-[#0f1218] px-3 py-2 text-left transition-colors hover:border-blue-400/50 hover:bg-blue-500/10"
                    >
                      <span className="block truncate text-[11px] font-semibold text-slate-100">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                        {item.area || "Area not set"} · {item.riskScore}% {item.riskLevel}
                      </span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setIsEquipmentSearchOpen(true);
                      setEquipmentSearchQuery("");
                    }}
                    className="rounded-lg border border-dashed border-blue-500/30 bg-[#0f1218] px-3 py-2 text-left transition-colors hover:border-blue-400/60 hover:bg-blue-500/10"
                  >
                    <span className="block truncate text-[11px] font-semibold text-blue-100">
                      Search all equipment
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                      Find by asset name, SAP number, area or OEM
                    </span>
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                  <p className="text-[10px] leading-relaxed text-yellow-100/80">
                    Equipment list is not available yet. Open the Equipment page and choose the asset manually.
                  </p>
                </div>
              )}

              {/* Inline equipment search */}
              {isEquipmentSearchOpen && (
                <div className="mt-3 rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-blue-100">
                        Search all equipment
                      </p>
                      <p className="mt-0.5 text-[10px] text-blue-100/60">
                        Search by asset name, SAP number, area, OEM or risk level.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsEquipmentSearchOpen(false);
                        setEquipmentSearchQuery("");
                      }}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-100/60 transition-colors hover:bg-white/10 hover:text-blue-100"
                      aria-label="Close equipment search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={equipmentSearchQuery}
                    onChange={(event) => setEquipmentSearchQuery(event.target.value)}
                    placeholder="Search equipment, SAP number, area or OEM..."
                    className="mb-3 w-full rounded-lg border border-gray-700 bg-[#141820] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                    autoFocus
                  />

                  {equipmentSearchQuery.trim() ? (
                    searchedEquipment.length > 0 ? (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {searchedEquipment.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openVisualDiagnosticForEquipment(item.id)}
                            className="rounded-lg border border-gray-800 bg-[#141820] px-3 py-2 text-left transition-colors hover:border-blue-400/50 hover:bg-blue-500/10"
                          >
                            <span className="block truncate text-[11px] font-semibold text-slate-100">
                              {item.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                              {item.area || "Area not set"} · {item.riskScore}% {item.riskLevel}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                        <p className="text-[10px] leading-relaxed text-yellow-100/80">
                          No matching equipment found. Try asset name, SAP number, OEM or area.
                        </p>
                      </div>
                    )
                  ) : (
                    <p className="text-[10px] text-slate-500">
                      Start typing to search the full equipment list.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prompt chips */}
          {resolvedPrompts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {resolvedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => openGlobalAi(prompt, true)}
                  className="rounded-full border border-gray-700 bg-[#0f1218] px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  );
}
