import { supabase } from "../../lib/supabaseClient";

export type SapTransactionCode =
  | "AUTO"
  | "TYPE_MAPPING"
  | "IH01"
  | "IW28"
  | "IW29"
  | "IW39"
  | "IP24";

export interface SapImportSite {
  id: string;
  name: string;
  organisationId: string;
  timezone: string;
  isDefault: boolean;
}

export interface SapImportTransaction {
  code: Exclude<SapTransactionCode, "AUTO">;
  label: string;
  description: string;
}

export interface SapImportBootstrap {
  sites: SapImportSite[];
  transactions: SapImportTransaction[];
  limits: {
    maxFileBytes: number;
    maxRows: number;
  };
}

export interface SapMappedHeader {
  sourceHeader: string;
  canonicalField: string;
}

export interface SapStructuralError {
  rowNumber: number;
  expectedColumns: number;
  actualColumns: number;
}

export interface SapRowValidationError {
  rowNumber: number;
  message: string;
}

export interface SapUnmappedCode {
  objectType: string;
  sourceCode: string;
  affectedRows: number;
}

export interface SapImportHistoryItem {
  id: string;
  transactionCode: string | null;
  fileName: string | null;
  fileChecksum: string | null;
  fileSizeBytes: number | null;
  status: string;
  rowCount: number;
  acceptedCount: number;
  rejectedCount: number;
  startedAt: string;
  completedAt: string | null;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  metadata: Record<string, unknown>;
}

export interface SapCsvPreview {
  fileName: string;
  fileSizeBytes: number;
  fileChecksum: string;

  transactionCode: Exclude<
    SapTransactionCode,
    "AUTO"
  >;

  delimiter: string;
  encoding: string;

  rawDataRowCount?: number;
  rowCount: number;
  ignoredHierarchyRowCount?: number;

  headers: string[];
  mappedHeaders: SapMappedHeader[];
  unmappedHeaders: string[];

  missingRequiredFields: string[];
  structuralErrors: SapStructuralError[];

  rowValidationErrors?: SapRowValidationError[];

  sampleRows: Array<Record<string, unknown>>;
  unmappedCodes: SapUnmappedCode[];

  duplicateImport: SapImportHistoryItem | null;
  rawFileRetained: boolean;
  canImport: boolean;
}

export interface SapImportRejection {
  id: number;
  entityType: string;
  sourceRowNumber: number | null;
  sourceRecordKey: string | null;
  errorCode: string;
  errorMessage: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface SapImportBatchReport {
  batch: {
    id: string;
    source_system: string;
    source_site_key: string | null;
    file_name: string | null;
    file_checksum: string | null;
    status: string;
    row_count: number;
    accepted_count: number;
    rejected_count: number;
    created_by: string | null;
    started_at: string;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    metadata: Record<string, unknown>;
  };

  rejections: SapImportRejection[];
  uploadedByName: string | null;
}

export interface SapImportIntegrityCheck {
  check_order: number;
  check_key: string;
  status: string;
  actual_count: number;
  detail: string;
}

export interface SapImportExecutionResult {
  batchId: string;

  transactionCode: Exclude<
    SapTransactionCode,
    "AUTO"
  >;

  acceptedCount: number;
  rejectedCount: number;
  insertedCount: number;
  updatedCount: number;

  ignoredHierarchyRowCount?: number;

  riskRefreshed: boolean;
  riskRefreshError: string | null;

  report: SapImportBatchReport;
  integrity: SapImportIntegrityCheck[];
}

export interface SapImportResponse {
  preview: SapCsvPreview;
  result: SapImportExecutionResult;
}

interface EdgeErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class SapImportApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details: unknown = null,
  ) {
    super(message);

    this.name = "SapImportApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const getEndpoint = (): string => {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL as
      | string
      | undefined;

  if (!supabaseUrl) {
    throw new SapImportApiError(
      500,
      "SUPABASE_URL_MISSING",
      "The Supabase URL is not configured.",
    );
  }

  return `${supabaseUrl}/functions/v1/sap-maintenance-csv-gateway`;
};

const getHeaders = async (
  includeJsonContentType: boolean,
): Promise<Record<string, string>> => {
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY as
      | string
      | undefined;

  if (!anonKey) {
    throw new SapImportApiError(
      500,
      "SUPABASE_KEY_MISSING",
      "The Supabase anonymous key is not configured.",
    );
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    throw new SapImportApiError(
      401,
      "AUTH_REQUIRED",
      "Your session has expired. Sign in again before importing SAP data.",
    );
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: anonKey,

    ...(includeJsonContentType
      ? {
          "Content-Type": "application/json",
        }
      : {}),
  };
};

const parseResponse = async <T>(
  response: Response,
): Promise<T> => {
  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const errorPayload =
      payload as EdgeErrorPayload | null;

    throw new SapImportApiError(
      response.status,
      errorPayload?.error?.code ??
        "SAP_IMPORT_REQUEST_FAILED",
      errorPayload?.error?.message ??
        "The SAP import request failed.",
      errorPayload?.error?.details ??
        null,
    );
  }

  return payload as T;
};

const invokeJson = async <T>(
  body: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(
    getEndpoint(),
    {
      method: "POST",
      headers: await getHeaders(true),
      body: JSON.stringify(body),
    },
  );

  return parseResponse<T>(response);
};

const invokeMultipart = async <T>(
  formData: FormData,
): Promise<T> => {
  const response = await fetch(
    getEndpoint(),
    {
      method: "POST",
      headers: await getHeaders(false),
      body: formData,
    },
  );

  return parseResponse<T>(response);
};

export const getSapImportBootstrap =
  async (): Promise<SapImportBootstrap> =>
    invokeJson<SapImportBootstrap>({
      action: "bootstrap",
    });

export const getSapImportHistory =
  async (
    siteId: string,
    limit = 20,
  ): Promise<SapImportHistoryItem[]> => {
    const response = await invokeJson<{
      history: SapImportHistoryItem[];
    }>({
      action: "history",
      siteId,
      limit,
    });

    return response.history;
  };

export const getSapImportReport =
  async (
    siteId: string,
    batchId: string,
  ): Promise<SapImportBatchReport> => {
    const response = await invokeJson<{
      report: SapImportBatchReport;
    }>({
      action: "report",
      siteId,
      batchId,
    });

    return response.report;
  };

interface SapCsvRequest {
  siteId: string;
  transactionCode: SapTransactionCode;
  file: File;
  allowDuplicate?: boolean;
}

const createCsvFormData = (
  action: "preview" | "import",
  request: SapCsvRequest,
): FormData => {
  const formData = new FormData();

  formData.append("action", action);
  formData.append(
    "siteId",
    request.siteId,
  );

  formData.append(
    "transactionCode",
    request.transactionCode,
  );

  /*
   * Vorta must not guess the meaning
   * of customer-specific SAP codes.
   */
  formData.append(
    "strictMappings",
    "true",
  );

  formData.append(
    "allowDuplicate",
    String(
      request.allowDuplicate ??
        false,
    ),
  );

  formData.append(
    "file",
    request.file,
    request.file.name,
  );

  return formData;
};

export const previewSapCsv =
  async (
    request: SapCsvRequest,
  ): Promise<SapCsvPreview> => {
    const response = await invokeMultipart<{
      preview: SapCsvPreview;
    }>(
      createCsvFormData(
        "preview",
        request,
      ),
    );

    return response.preview;
  };

export const importSapCsv =
  async (
    request: SapCsvRequest,
  ): Promise<SapImportResponse> =>
    invokeMultipart<SapImportResponse>(
      createCsvFormData(
        "import",
        request,
      ),
    );
