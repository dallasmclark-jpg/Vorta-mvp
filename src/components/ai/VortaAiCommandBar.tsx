import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
  Trash2,
  Upload,
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

// ─── Document intake constants ────────────────────────────────────────────────

const DOCUMENT_CONTEXT_TYPES = [
  "SOP / Work Instruction",
  "OEM Manual",
  "SAP Export",
  "Training Record",
  "Job Report",
  "Handover Note",
  "Other",
];

const DOCUMENT_RELATION_TYPES = [
  "Site-wide",
  "Equipment / asset",
  "Shift / handover",
  "PM / work orders",
  "Skills / training",
  "Spares / BOM",
  "Contractor / job report",
];

const SUPPORTED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  const documentInputRef = useRef<HTMLInputElement>(null);
  const [isDocumentIntakeOpen, setIsDocumentIntakeOpen] = useState(false);
  const [documentFileName, setDocumentFileName] = useState("");
  const [documentFileSize, setDocumentFileSize] = useState("");
  const [documentFileType, setDocumentFileType] = useState("");
  const [documentContextType, setDocumentContextType] = useState(DOCUMENT_CONTEXT_TYPES[0]);
  const [documentRelationType, setDocumentRelationType] = useState(DOCUMENT_RELATION_TYPES[0]);
  const [documentLinkedEquipmentId, setDocumentLinkedEquipmentId] = useState("");
  const [documentLinkedEquipmentName, setDocumentLinkedEquipmentName] = useState("");
  const [documentEquipmentSearchOpen, setDocumentEquipmentSearchOpen] = useState(false);
  const [documentEquipmentSearchQuery, setDocumentEquipmentSearchQuery] = useState("");
  const [documentContextNote, setDocumentContextNote] = useState("");
  const [documentIntakeMessage, setDocumentIntakeMessage] = useState("");

  useEffect(() => {
    if (enablePhotoUpload || enableDocumentUpload) {
      getEquipmentList().then(setEquipmentList);
    }
  }, [enablePhotoUpload, enableDocumentUpload]);

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

  const searchedDocumentEquipment = equipmentList
    .filter((item) => {
      const q = documentEquipmentSearchQuery.trim().toLowerCase();
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
      description: "SOP, work instruction, report, PDF or export",
      icon: FileText,
      prompt: "document-intake-panel",
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
    setIsDocumentIntakeOpen(false);
    setDocumentEquipmentSearchOpen(false);
    setDocumentEquipmentSearchQuery("");
  };

  const openPhotoEquipmentPicker = () => {
    setIsAttachmentMenuOpen(false);
    setIsPhotoEquipmentPickerOpen(true);
    setIsEquipmentSearchOpen(false);
    setEquipmentSearchQuery("");
    setIsDocumentIntakeOpen(false);
    setDocumentEquipmentSearchOpen(false);
    setDocumentEquipmentSearchQuery("");
  };

  const openVisualDiagnosticForEquipment = (equipmentId: string) => {
    closeAllPanels();
    setAiInput("");
    navigate(`/equipment/${equipmentId}/ai-insights?visualDiagnostic=upload`);
  };

  const resetDocumentIntake = () => {
    setDocumentFileName("");
    setDocumentFileSize("");
    setDocumentFileType("");
    setDocumentContextType(DOCUMENT_CONTEXT_TYPES[0]);
    setDocumentRelationType(DOCUMENT_RELATION_TYPES[0]);
    setDocumentLinkedEquipmentId("");
    setDocumentLinkedEquipmentName("");
    setDocumentEquipmentSearchOpen(false);
    setDocumentEquipmentSearchQuery("");
    setDocumentContextNote("");
    setDocumentIntakeMessage("");
    if (documentInputRef.current) {
      documentInputRef.current.value = "";
    }
  };

  const openDocumentIntakePanel = () => {
    setIsAttachmentMenuOpen(false);
    setIsPhotoEquipmentPickerOpen(false);
    setIsEquipmentSearchOpen(false);
    setEquipmentSearchQuery("");
    setIsDocumentIntakeOpen(true);
    setDocumentIntakeMessage("");
  };

  const handleDocumentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.toLowerCase().split(".").pop() ?? "";
    const allowedExtensions = ["pdf", "doc", "docx", "txt", "csv", "xls", "xlsx"];

    const isSupportedType =
      SUPPORTED_DOCUMENT_TYPES.includes(file.type) ||
      allowedExtensions.includes(fileExtension);

    if (!isSupportedType) {
      resetDocumentIntake();
      setDocumentIntakeMessage("Unsupported file type for this MVP placeholder. Use PDF, Word, Excel, CSV or text.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      resetDocumentIntake();
      setDocumentIntakeMessage("File is too large for this MVP placeholder. Use a file under 15 MB.");
      return;
    }

    setDocumentFileName(file.name);
    setDocumentFileSize(formatFileSize(file.size));
    setDocumentFileType(file.type || fileExtension.toUpperCase());
    setDocumentIntakeMessage("File selected. Vorta will not read the file contents yet, but this prepares the document context workflow.");
  };

  const selectDocumentEquipment = (item: EquipmentListItem) => {
    setDocumentLinkedEquipmentId(item.id);
    setDocumentLinkedEquipmentName(item.name);
    setDocumentEquipmentSearchOpen(false);
    setDocumentEquipmentSearchQuery("");
  };

  const sendDocumentContextToVorta = () => {
    if (!documentFileName) {
      setDocumentIntakeMessage("Choose a document first.");
      return;
    }

    if (documentRelationType === "Equipment / asset" && !documentLinkedEquipmentId) {
      setDocumentIntakeMessage("Choose the equipment this document relates to.");
      return;
    }

    const contextText = [
      `I want to analyse a ${documentContextType} document.`,
      `File selected: ${documentFileName} (${documentFileSize}, ${documentFileType || "unknown type"}).`,
      `Document relates to: ${documentRelationType}.`,
      documentLinkedEquipmentName
        ? `Linked equipment: ${documentLinkedEquipmentName}.`
        : "Linked equipment: not selected.",
      documentContextNote.trim()
        ? `Context note: ${documentContextNote.trim()}`
        : "Context note: not provided.",
      "This MVP has not processed the file contents yet. Ask me what should be extracted, validated or linked to Vorta risk intelligence.",
    ].join(" ");

    setAiInput(contextText);
    closeAllPanels();

    window.dispatchEvent(
      new CustomEvent("vorta-global-ai-prompt", {
        detail: { question: contextText, submit: false, role },
      }),
    );
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

    if (prompt === "document-intake-panel") {
      openDocumentIntakePanel();
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

          {/* Document intake panel */}
          {isDocumentIntakeOpen && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-100">
                    Add document context
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-blue-100/60">
                    Select a document, classify it, and tell Vorta what it relates to. File content extraction will be connected later.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsDocumentIntakeOpen(false);
                    resetDocumentIntake();
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-100/60 transition-colors hover:bg-white/10 hover:text-blue-100"
                  aria-label="Close document intake"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                onChange={handleDocumentFileChange}
                className="hidden"
              />

              <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                {/* File drop zone + context note */}
                <div className="rounded-lg border border-dashed border-blue-500/25 bg-[#0f1218] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-200">
                        {documentFileName || "No document selected"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {documentFileName
                          ? `${documentFileSize} · ${documentFileType || "Unknown type"}`
                          : "PDF, Word, Excel, CSV or text file"}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => documentInputRef.current?.click()}
                        className="h-auto gap-2 border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[10px] font-semibold text-blue-100 hover:bg-blue-500/20"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Choose file
                      </Button>

                      {documentFileName && (
                        <button
                          type="button"
                          onClick={resetDocumentIntake}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-300"
                          aria-label="Remove selected document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Context note
                    </label>
                    <textarea
                      value={documentContextNote}
                      onChange={(event) => setDocumentContextNote(event.target.value)}
                      placeholder="Example: This is yesterday's SAP work order export for Building 2. Check overdue PMs and repeat faults."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-gray-700 bg-[#141820] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Document type + relation type selectors */}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Document type
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {DOCUMENT_CONTEXT_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setDocumentContextType(type)}
                          className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-medium transition-colors ${
                            documentContextType === type
                              ? "border-blue-500/50 bg-blue-500/15 text-blue-100"
                              : "border-gray-800 bg-[#141820] text-slate-500 hover:border-blue-500/25 hover:text-slate-300"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Relates to
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {DOCUMENT_RELATION_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setDocumentRelationType(type);
                            if (type !== "Equipment / asset") {
                              setDocumentLinkedEquipmentId("");
                              setDocumentLinkedEquipmentName("");
                              setDocumentEquipmentSearchOpen(false);
                              setDocumentEquipmentSearchQuery("");
                            }
                          }}
                          className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-medium transition-colors ${
                            documentRelationType === type
                              ? "border-blue-500/50 bg-blue-500/15 text-blue-100"
                              : "border-gray-800 bg-[#141820] text-slate-500 hover:border-blue-500/25 hover:text-slate-300"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment linker — only when "Equipment / asset" is selected */}
              {documentRelationType === "Equipment / asset" && (
                <div className="mt-3 rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-blue-100">
                        Link document to equipment
                      </p>
                      <p className="mt-0.5 text-[10px] text-blue-100/60">
                        Select from top-risk equipment or search the full asset list.
                      </p>
                    </div>

                    {documentLinkedEquipmentName && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                        {documentLinkedEquipmentName}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {topPhotoDiagnosticEquipment.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectDocumentEquipment(item)}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                          documentLinkedEquipmentId === item.id
                            ? "border-emerald-400/60 bg-emerald-500/10"
                            : "border-blue-500/20 bg-[#141820] hover:border-blue-400/50 hover:bg-blue-500/10"
                        }`}
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
                        setDocumentEquipmentSearchOpen(true);
                        setDocumentEquipmentSearchQuery("");
                      }}
                      className="rounded-lg border border-dashed border-blue-500/30 bg-[#141820] px-3 py-2 text-left transition-colors hover:border-blue-400/60 hover:bg-blue-500/10"
                    >
                      <span className="block truncate text-[11px] font-semibold text-blue-100">
                        Search all equipment
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                        Find by asset name, SAP number, area or OEM
                      </span>
                    </button>
                  </div>

                  {documentEquipmentSearchOpen && (
                    <div className="mt-3 rounded-lg border border-blue-500/20 bg-[#141820] p-3">
                      <input
                        type="text"
                        value={documentEquipmentSearchQuery}
                        onChange={(event) => setDocumentEquipmentSearchQuery(event.target.value)}
                        placeholder="Search equipment, SAP number, area or OEM..."
                        className="mb-3 w-full rounded-lg border border-gray-700 bg-[#0f1218] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                        autoFocus
                      />

                      {documentEquipmentSearchQuery.trim() ? (
                        searchedDocumentEquipment.length > 0 ? (
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {searchedDocumentEquipment.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => selectDocumentEquipment(item)}
                                className="rounded-lg border border-gray-800 bg-[#0f1218] px-3 py-2 text-left transition-colors hover:border-blue-400/50 hover:bg-blue-500/10"
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

              {documentIntakeMessage && (
                <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                  <p className="text-[10px] leading-relaxed text-yellow-100/80">
                    {documentIntakeMessage}
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2 border-t border-blue-500/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[9px] leading-relaxed text-blue-100/50">
                  MVP placeholder only: the file is not uploaded, stored or parsed yet. This captures document context for the AI workflow.
                </p>

                <Button
                  type="button"
                  onClick={sendDocumentContextToVorta}
                  disabled={!documentFileName}
                  className="h-auto gap-2 bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send to Vorta
                </Button>
              </div>
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
