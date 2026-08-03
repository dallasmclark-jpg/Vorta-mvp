export type ConversationContextSubject =
  | "site"
  | "site_priorities"
  | "equipment"
  | "shift_cover"
  | "maintenance_plan"
  | "spares"
  | "documents"
  | "work"
  | "skills"
  | "handover"
  | "risk"
  | "mixed";

export type ConversationContextOptionType =
  | "equipment"
  | "ranked_action"
  | "cover"
  | "spare"
  | "document"
  | "work"
  | "skill";

export interface ConversationContextOption {
  position: number;
  type: ConversationContextOptionType;
  label: string;
  equipmentQuery?: string;
  equipmentId?: string;
  reference?: string;
  value?: string;
}

export interface ConversationContext {
  version: 1;
  subject: ConversationContextSubject;
  intent: string;
  activeEquipment: {
    query: string;
    id?: string;
    code?: string;
    name?: string;
  } | null;
  area: string | null;
  shift: {
    team?: string;
    type?: string;
    date?: string;
  } | null;
  dateRange: {
    startDate: string;
    endDate: string;
    timezone: string;
  } | null;
  orderedOptions: ConversationContextOption[];
  selectedOption: ConversationContextOption | null;
  updatedAt: string | null;
}

export interface ConversationContextResolution {
  context: ConversationContext | null;
  selectedOption: ConversationContextOption | null;
  activeEquipmentQuery: string | null;
  inheritedSubject: ConversationContextSubject | null;
  inheritedDateRange: ConversationContext["dateRange"];
  shouldClarify: boolean;
  clarificationQuestion: string | null;
  usedContext: boolean;
  hasExplicitDate: boolean;
  hasExplicitEquipment: boolean;
}

export function sanitizeConversationContext(value: unknown): ConversationContext | null;
export function resolveConversationFollowUp(
  question: string,
  context: unknown,
): ConversationContextResolution;
export function contextResolutionPrompt(resolution: unknown): string;
export function createConversationContext(value: Partial<ConversationContext>): ConversationContext | null;
