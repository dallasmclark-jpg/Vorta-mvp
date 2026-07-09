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
  Mic,
  MicOff,
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

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = {
  readonly error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

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
  enableVoiceInput?: boolean;
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

const IMPORT_SOURCE_TYPES = [
  "SAP IH08 Equipment Register",
  "SAP IH01 Functional Location / Structure",
  "SAP IP24 PM Schedule",
  "SAP IW39 Work Order History",
  "SAP IB05 Equipment BOM",
  "SAP MB52 Stores Inventory",
  "Skills Matrix Import",
  "Training Records Import",
  "Contractor Register Import",
  "Other Import File",
];

const IMPORT_UPDATE_TARGETS = [
  "Update equipment register",
  "Update PM backlog",
  "Update work order history",
  "Update spares / BOM risk",
  "Update skills / training risk",
  "Update contractor cover",
  "Compare against current Vorta risk",
  "Create import mapping notes",
];

const SUPPORTED_IMPORT_FILE_TYPES = [
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const HANDOVER_SHIFT_TYPES = [
  "Current shift",
  "Day shift",
  "Night shift",
  "Weekend shift",
  "Contractor handover",
  "Production handover",
  "Maintenance handover",
];

const HANDOVER_RELATION_TYPES = [
  "Site-wide",
  "Equipment / asset",
  "Shift cover",
  "PM / work orders",
  "Spares / parts",
  "Skills / training",
  "Production issue",
  "Safety / compliance",
];

const HANDOVER_ANALYSIS_TARGETS = [
  "Identify risks",
  "Extract actions and owners",
  "Check equipment impact",
  "Check shift cover impact",
  "Check PM / work order impact",
  "Check spares impact",
  "Prepare next-shift briefing",
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
  enableVoiceInput = true,
}: VortaAiCommandBarProps): JSX.Element {
  const navigate = useNavigate();

  const roleCopy = ROLE_COPY[role];
  const resolvedDescription = description ?? roleCopy.description;
  const resolvedPlaceholder = placeholder ?? roleCopy.placeholder;
  const resolvedPrompts = prompts ?? roleCopy.prompts;

  const [aiInput, setAiInput] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
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

  const importInputRef = useRef<HTMLInputElement>(null);
  const [isImportIntakeOpen, setIsImportIntakeOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importFileSize, setImportFileSize] = useState("");
  const [importFileType, setImportFileType] = useState("");
  const [importSourceType, setImportSourceType] = useState(IMPORT_SOURCE_TYPES[0]);
  const [importUpdateTarget, setImportUpdateTarget] = useState(IMPORT_UPDATE_TARGETS[0]);
  const [importLinkedEquipmentId, setImportLinkedEquipmentId] = useState("");
  const [importLinkedEquipmentName, setImportLinkedEquipmentName] = useState("");
  const [importEquipmentSearchOpen, setImportEquipmentSearchOpen] = useState(false);
  const [importEquipmentSearchQuery, setImportEquipmentSearchQuery] = useState("");
  const [importContextNote, setImportContextNote] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const [isHandoverIntakeOpen, setIsHandoverIntakeOpen] = useState(false);
  const [handoverShiftType, setHandoverShiftType] = useState(HANDOVER_SHIFT_TYPES[0]);
  const [handoverRelationType, setHandoverRelationType] = useState(HANDOVER_RELATION_TYPES[0]);
  const [handoverAnalysisTarget, setHandoverAnalysisTarget] = useState(HANDOVER_ANALYSIS_TARGETS[0]);
  const [handoverLinkedEquipmentId, setHandoverLinkedEquipmentId] = useState("");
  const [handoverLinkedEquipmentName, setHandoverLinkedEquipmentName] = useState("");
  const [handoverEquipmentSearchOpen, setHandoverEquipmentSearchOpen] = useState(false);
  const [handoverEquipmentSearchQuery, setHandoverEquipmentSearchQuery] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [handoverOwnerNote, setHandoverOwnerNote] = useState("");
  const [handoverMessage, setHandoverMessage] = useState("");

  useEffect(() => {
    if (enablePhotoUpload || enableDocumentUpload || enableHandoverNote) {
      getEquipmentList().then(setEquipmentList);
    }
  }, [enablePhotoUpload, enableDocumentUpload, enableHandoverNote]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

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

  const searchedImportEquipment = equipmentList
    .filter((item) => {
      const q = importEquipmentSearchQuery.trim().toLowerCase();
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

  const searchedHandoverEquipment = equipmentList
    .filter((item) => {
      const q = handoverEquipmentSearchQuery.trim().toLowerCase();
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
      prompt: "handover-intake-panel",
    },
    enableSapExport && {
      label: "Import data file",
      description: "SAP, skills, PM, spares or work order import",
      icon: Table2,
      prompt: "import-intake-panel",
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
    setIsImportIntakeOpen(false);
    setImportEquipmentSearchOpen(false);
    setImportEquipmentSearchQuery("");
    setIsHandoverIntakeOpen(false);
    setHandoverEquipmentSearchOpen(false);
    setHandoverEquipmentSearchQuery("");
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
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    fireGlobalAiPrompt(trimmed, submit);
    closeAllPanels();
    setAiInput("");
  };

  const toggleVoiceInput = () => {
    if (!enableVoiceInput) return;

    setVoiceMessage("");

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceMessage("Voice input is not supported in this browser. Type the question instead.");
      return;
    }

    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-GB";

      let finalTranscript = "";

      recognition.onresult = (event) => {
        let interimTranscript = "";

        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? "";

          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const spokenText = `${finalTranscript} ${interimTranscript}`.trim();

        if (spokenText) {
          setAiInput((current) => {
            const base = current.trim();
            return base ? `${base} ${spokenText}` : spokenText;
          });
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        recognitionRef.current = null;
        setVoiceMessage(
          event.error === "not-allowed"
            ? "Microphone permission was blocked. Enable microphone access to use voice input."
            : "Voice input stopped. Type the question or try the microphone again.",
        );
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
      setIsListening(true);
      setVoiceMessage("Listening... Speak clearly, then review the text before asking Vorta.");
    } catch (error) {
      console.warn("Voice input failed:", error);
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceMessage("Voice input could not start in this browser.");
    }
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

    if (prompt === "import-intake-panel") {
      openImportIntakePanel();
      return;
    }

    if (prompt === "handover-intake-panel") {
      openHandoverIntakePanel();
      return;
    }

    setAiInput(prompt);
    closeAllPanels();
    fireGlobalAiPrompt(prompt, false);
  };

  const resetHandoverIntake = () => {
    setHandoverShiftType(HANDOVER_SHIFT_TYPES[0]);
    setHandoverRelationType(HANDOVER_RELATION_TYPES[0]);
    setHandoverAnalysisTarget(HANDOVER_ANALYSIS_TARGETS[0]);
    setHandoverLinkedEquipmentId("");
    setHandoverLinkedEquipmentName("");
    setHandoverEquipmentSearchOpen(false);
    setHandoverEquipmentSearchQuery("");
    setHandoverNote("");
    setHandoverOwnerNote("");
    setHandoverMessage("");
  };

  const openHandoverIntakePanel = () => {
    setIsAttachmentMenuOpen(false);
    setIsPhotoEquipmentPickerOpen(false);
    setIsEquipmentSearchOpen(false);
    setEquipmentSearchQuery("");
    setIsDocumentIntakeOpen(false);
    setDocumentEquipmentSearchOpen(false);
    setDocumentEquipmentSearchQuery("");
    setIsImportIntakeOpen(false);
    setImportEquipmentSearchOpen(false);
    setImportEquipmentSearchQuery("");
    setIsHandoverIntakeOpen(true);
    setHandoverMessage("");
  };

  const selectHandoverEquipment = (item: EquipmentListItem) => {
    setHandoverLinkedEquipmentId(item.id);
    setHandoverLinkedEquipmentName(item.name);
    setHandoverEquipmentSearchOpen(false);
    setHandoverEquipmentSearchQuery("");
  };

  const sendHandoverContextToVorta = () => {
    const trimmedNote = handoverNote.trim();

    if (!trimmedNote) {
      setHandoverMessage("Paste a handover note first.");
      return;
    }

    if (handoverRelationType === "Equipment / asset" && !handoverLinkedEquipmentId) {
      setHandoverMessage("Choose the equipment this handover note relates to.");
      return;
    }

    const contextText = [
      "I want to analyse a shift handover note.",
      `Shift type: ${handoverShiftType}.`,
      `Handover relates to: ${handoverRelationType}.`,
      `Analysis target: ${handoverAnalysisTarget}.`,
      handoverLinkedEquipmentName
        ? `Linked equipment: ${handoverLinkedEquipmentName}.`
        : "Linked equipment: not selected.",
      handoverOwnerNote.trim()
        ? `Owner/team note: ${handoverOwnerNote.trim()}`
        : "Owner/team note: not provided.",
      `Handover note: ${trimmedNote}`,
      "Identify risks, actions, owners, missing information and anything that should be escalated before the next shift.",
    ].join(" ");

    setAiInput(contextText);
    closeAllPanels();

    window.dispatchEvent(
      new CustomEvent("vorta-global-ai-prompt", {
        detail: { question: contextText, submit: false, role },
      }),
    );
  };

  const resetImportIntake = () => {
    setImportFileName("");
    setImportFileSize("");
    setImportFileType("");
    setImportSourceType(IMPORT_SOURCE_TYPES[0]);
    setImportUpdateTarget(IMPORT_UPDATE_TARGETS[0]);
    setImportLinkedEquipmentId("");
    setImportLinkedEquipmentName("");
    setImportEquipmentSearchOpen(false);
    setImportEquipmentSearchQuery("");
    setImportContextNote("");
    setImportMessage("");
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  };

  const openImportIntakePanel = () => {
    setIsAttachmentMenuOpen(false);
    setIsPhotoEquipmentPickerOpen(false);
    setIsEquipmentSearchOpen(false);
    setEquipmentSearchQuery("");
    setIsDocumentIntakeOpen(false);
    setDocumentEquipmentSearchOpen(false);
    setDocumentEquipmentSearchQuery("");
    setIsImportIntakeOpen(true);
    setImportMessage("");
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.toLowerCase().split(".").pop() ?? "";
    const allowedExtensions = ["csv", "txt", "xls", "xlsx"];

    const isSupportedType =
      SUPPORTED_IMPORT_FILE_TYPES.includes(file.type) ||
      allowedExtensions.includes(fileExtension);

    if (!isSupportedType) {
      resetImportIntake();
      setImportMessage("Unsupported import file type for this MVP placeholder. Use CSV, Excel or text.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      resetImportIntake();
      setImportMessage("File is too large for this MVP placeholder. Use an import file under 20 MB.");
      return;
    }

    setImportFileName(file.name);
    setImportFileSize(formatFileSize(file.size));
    setImportFileType(file.type || fileExtension.toUpperCase());
    setImportMessage("Import file selected. Vorta will not import or parse the file yet, but this prepares the mapping workflow.");
  };

  const selectImportEquipment = (item: EquipmentListItem) => {
    setImportLinkedEquipmentId(item.id);
    setImportLinkedEquipmentName(item.name);
    setImportEquipmentSearchOpen(false);
    setImportEquipmentSearchQuery("");
  };

  const sendImportContextToVorta = () => {
    if (!importFileName) {
      setImportMessage("Choose an import file first.");
      return;
    }

    const contextText = [
      "I want to plan a data import into Vorta.",
      `Source file type: ${importSourceType}.`,
      `File selected: ${importFileName} (${importFileSize}, ${importFileType || "unknown type"}).`,
      `Intended update: ${importUpdateTarget}.`,
      importLinkedEquipmentName
        ? `Linked equipment: ${importLinkedEquipmentName}.`
        : "Linked equipment: not selected.",
      importContextNote.trim()
        ? `Context note: ${importContextNote.trim()}`
        : "Context note: not provided.",
      "This MVP has not imported or parsed the file yet. Ask me what fields should be mapped, validated or checked before updating Vorta risk intelligence.",
    ].join(" ");

    setAiInput(contextText);
    closeAllPanels();

    window.dispatchEvent(
      new CustomEvent("vorta-global-ai-prompt", {
        detail: { question: contextText, submit: false, role },
      }),
    );
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
                      recognitionRef.current?.stop();
                      recognitionRef.current = null;
                      setIsListening(false);
                      closeAllPanels();
                    }
                  }}
                  placeholder={resolvedPlaceholder}
                  className="w-full border-0 bg-transparent py-1.5 pl-7 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              {enableVoiceInput && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                    isListening
                      ? "bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      : "text-slate-500 hover:bg-white/5 hover:text-blue-300"
                  }`}
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  title={isListening ? "Stop voice input" : "Start voice input"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
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

          {voiceMessage && (
            <div
              className={`rounded-lg border px-3 py-2 ${
                isListening
                  ? "border-blue-500/20 bg-blue-500/10"
                  : "border-yellow-500/20 bg-yellow-500/10"
              }`}
            >
              <p
                className={`text-[10px] leading-relaxed ${
                  isListening ? "text-blue-100/80" : "text-yellow-100/80"
                }`}
              >
                {voiceMessage}
              </p>
            </div>
          )}
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

          {/* Import data intake panel */}
          {isImportIntakeOpen && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-100">
                    Import data into Vorta
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-blue-100/60">
                    Select the source file and tell Vorta what it should update. Import parsing will be connected later.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsImportIntakeOpen(false);
                    resetImportIntake();
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-100/60 transition-colors hover:bg-white/10 hover:text-blue-100"
                  aria-label="Close import intake"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.txt,.xls,.xlsx"
                onChange={handleImportFileChange}
                className="hidden"
              />

              <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                {/* File selector + context note */}
                <div className="rounded-lg border border-dashed border-blue-500/25 bg-[#0f1218] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-200">
                        {importFileName || "No import file selected"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {importFileName
                          ? `${importFileSize} · ${importFileType || "Unknown type"}`
                          : "CSV, Excel or text file"}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => importInputRef.current?.click()}
                        className="h-auto gap-2 border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[10px] font-semibold text-blue-100 hover:bg-blue-500/20"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Choose file
                      </Button>

                      {importFileName && (
                        <button
                          type="button"
                          onClick={resetImportIntake}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-300"
                          aria-label="Remove selected import file"
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
                      value={importContextNote}
                      onChange={(event) => setImportContextNote(event.target.value)}
                      placeholder="Example: This is an IW39 export for Building 2 covering the last 90 days. Check repeat faults and overdue actions."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-gray-700 bg-[#141820] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Source file type + intended update selectors */}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Source file type
                    </label>
                    <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
                      {IMPORT_SOURCE_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setImportSourceType(type)}
                          className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-medium transition-colors ${
                            importSourceType === type
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
                      Intended update
                    </label>
                    <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
                      {IMPORT_UPDATE_TARGETS.map((target) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => setImportUpdateTarget(target)}
                          className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-medium transition-colors ${
                            importUpdateTarget === target
                              ? "border-blue-500/50 bg-blue-500/15 text-blue-100"
                              : "border-gray-800 bg-[#141820] text-slate-500 hover:border-blue-500/25 hover:text-slate-300"
                          }`}
                        >
                          {target}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional equipment link */}
              <div className="mt-3 rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-blue-100">
                      Optional equipment link
                    </p>
                    <p className="mt-0.5 text-[10px] text-blue-100/60">
                      Link this import to an asset when it is equipment-specific. Site-wide imports can leave this blank.
                    </p>
                  </div>

                  {importLinkedEquipmentName && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                      {importLinkedEquipmentName}
                    </span>
                  )}
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {topPhotoDiagnosticEquipment.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectImportEquipment(item)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        importLinkedEquipmentId === item.id
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
                      setImportEquipmentSearchOpen(true);
                      setImportEquipmentSearchQuery("");
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

                {importEquipmentSearchOpen && (
                  <div className="mt-3 rounded-lg border border-blue-500/20 bg-[#141820] p-3">
                    <input
                      type="text"
                      value={importEquipmentSearchQuery}
                      onChange={(event) => setImportEquipmentSearchQuery(event.target.value)}
                      placeholder="Search equipment, SAP number, area or OEM..."
                      className="mb-3 w-full rounded-lg border border-gray-700 bg-[#0f1218] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                      autoFocus
                    />

                    {importEquipmentSearchQuery.trim() ? (
                      searchedImportEquipment.length > 0 ? (
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {searchedImportEquipment.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => selectImportEquipment(item)}
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

              {importMessage && (
                <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                  <p className="text-[10px] leading-relaxed text-yellow-100/80">
                    {importMessage}
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2 border-t border-blue-500/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[9px] leading-relaxed text-blue-100/50">
                  MVP placeholder only: the file is not uploaded, stored, parsed or imported yet. This captures mapping context for the AI workflow.
                </p>

                <Button
                  type="button"
                  onClick={sendImportContextToVorta}
                  disabled={!importFileName}
                  className="h-auto gap-2 bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send import context
                </Button>
              </div>
            </div>
          )}

          {/* Handover intake panel */}
          {isHandoverIntakeOpen && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-100">
                    Paste handover note
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-blue-100/60">
                    Paste a shift handover, fault note or meeting action and tell Vorta what to check.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsHandoverIntakeOpen(false);
                    resetHandoverIntake();
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-100/60 transition-colors hover:bg-white/10 hover:text-blue-100"
                  aria-label="Close handover intake"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                {/* Note + owner */}
                <div className="rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Handover note
                  </label>

                  <textarea
                    value={handoverNote}
                    onChange={(event) => setHandoverNote(event.target.value)}
                    placeholder="Paste the handover note here. Example: Line 2 tripped twice on nights, reset and running. Infeed sensor cleaned but alarm returned once. Sarah aware. Check spare sensor stock before next shift."
                    rows={7}
                    className="w-full resize-none rounded-lg border border-gray-700 bg-[#141820] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                  />

                  <div className="mt-3">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Owner / team note
                    </label>
                    <input
                      type="text"
                      value={handoverOwnerNote}
                      onChange={(event) => setHandoverOwnerNote(event.target.value)}
                      placeholder="Optional: Team A nights, Sarah Jones, contractor due tomorrow..."
                      className="w-full rounded-lg border border-gray-700 bg-[#141820] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Selectors */}
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Shift type
                    </label>
                    <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
                      {HANDOVER_SHIFT_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setHandoverShiftType(type)}
                          className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-medium transition-colors ${
                            handoverShiftType === type
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
                    <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
                      {HANDOVER_RELATION_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setHandoverRelationType(type);
                            if (type !== "Equipment / asset") {
                              setHandoverLinkedEquipmentId("");
                              setHandoverLinkedEquipmentName("");
                              setHandoverEquipmentSearchOpen(false);
                              setHandoverEquipmentSearchQuery("");
                            }
                          }}
                          className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-medium transition-colors ${
                            handoverRelationType === type
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
                      What should Vorta do?
                    </label>
                    <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
                      {HANDOVER_ANALYSIS_TARGETS.map((target) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => setHandoverAnalysisTarget(target)}
                          className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-medium transition-colors ${
                            handoverAnalysisTarget === target
                              ? "border-blue-500/50 bg-blue-500/15 text-blue-100"
                              : "border-gray-800 bg-[#141820] text-slate-500 hover:border-blue-500/25 hover:text-slate-300"
                          }`}
                        >
                          {target}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment linker — only when "Equipment / asset" is selected */}
              {handoverRelationType === "Equipment / asset" && (
                <div className="mt-3 rounded-lg border border-blue-500/20 bg-[#0f1218] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-blue-100">
                        Link handover to equipment
                      </p>
                      <p className="mt-0.5 text-[10px] text-blue-100/60">
                        Select from top-risk equipment or search the full asset list.
                      </p>
                    </div>

                    {handoverLinkedEquipmentName && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                        {handoverLinkedEquipmentName}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {topPhotoDiagnosticEquipment.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectHandoverEquipment(item)}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                          handoverLinkedEquipmentId === item.id
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
                        setHandoverEquipmentSearchOpen(true);
                        setHandoverEquipmentSearchQuery("");
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

                  {handoverEquipmentSearchOpen && (
                    <div className="mt-3 rounded-lg border border-blue-500/20 bg-[#141820] p-3">
                      <input
                        type="text"
                        value={handoverEquipmentSearchQuery}
                        onChange={(event) => setHandoverEquipmentSearchQuery(event.target.value)}
                        placeholder="Search equipment, SAP number, area or OEM..."
                        className="mb-3 w-full rounded-lg border border-gray-700 bg-[#0f1218] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                        autoFocus
                      />

                      {handoverEquipmentSearchQuery.trim() ? (
                        searchedHandoverEquipment.length > 0 ? (
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {searchedHandoverEquipment.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => selectHandoverEquipment(item)}
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

              {handoverMessage && (
                <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                  <p className="text-[10px] leading-relaxed text-yellow-100/80">
                    {handoverMessage}
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2 border-t border-blue-500/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[9px] leading-relaxed text-blue-100/50">
                  MVP placeholder only: the handover note is not stored yet. This captures context for the AI workflow.
                </p>

                <Button
                  type="button"
                  onClick={sendHandoverContextToVorta}
                  disabled={!handoverNote.trim()}
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
