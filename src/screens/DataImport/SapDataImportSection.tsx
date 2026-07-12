import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  ReactNode,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

import { Button } from "../../components/ui/button";

import {
  getSapImportBootstrap,
  getSapImportHistory,
  getSapImportReport,
  importSapCsv,
  previewSapCsv,
  SapImportApiError,
} from "./sapImportService";

import type {
  SapCsvPreview,
  SapImportBatchReport,
  SapImportBootstrap,
  SapImportExecutionResult,
  SapImportHistoryItem,
  SapImportRejection,
  SapTransactionCode,
} from "./sapImportService";

const DEFAULT_MAX_FILE_BYTES =
  10 * 1024 * 1024;

const formatBytes = (
  bytes: number,
): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
};

const formatDateTime = (
  value: string | null,
): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
};

const formatCellValue = (
  value: unknown,
): string => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value === "object"
  ) {
    return JSON.stringify(value);
  }

  return String(value);
};

const getErrorMessage = (
  error: unknown,
): string => {
  if (
    error instanceof
    SapImportApiError
  ) {
    return error.message;
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "The request failed unexpectedly.";
};

const isPreviewDetails = (
  value: unknown,
): value is SapCsvPreview =>
  typeof value === "object" &&
  value !== null &&
  "fileName" in value &&
  "transactionCode" in value &&
  "rowCount" in value;

const escapeCsvCell = (
  value: unknown,
): string => {
  let text = formatCellValue(value);

  /*
   * Protect files opened in Excel
   * from CSV formula injection.
   */
  if (
    /^[=+\-@]/.test(text)
  ) {
    text = `'${text}`;
  }

  return `"${text.replace(
    /"/g,
    '""',
  )}"`;
};

const downloadTextFile = (
  content: string,
  fileName: string,
): void => {
  const blob = new Blob(
    [content],
    {
      type: "text/csv;charset=utf-8",
    },
  );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url,
      ),
    0,
  );
};

const createRejectionCsv = (
  rejections: SapImportRejection[],
): string => {
  const headers = [
    "sourceRowNumber",
    "sourceRecordKey",
    "entityType",
    "errorCode",
    "errorMessage",
    "payload",
  ];

  const rows = rejections.map(
    (rejection) => [
      rejection.sourceRowNumber,
      rejection.sourceRecordKey,
      rejection.entityType,
      rejection.errorCode,
      rejection.errorMessage,
      rejection.payload
        ? JSON.stringify(
            rejection.payload,
          )
        : "",
    ],
  );

  return [
    headers,
    ...rows,
  ]
    .map((row) =>
      row
        .map(escapeCsvCell)
        .join(","),
    )
    .join("\r\n");
};

const downloadMappingTemplate =
  (): void => {
    const headers = [
      "object_type",
      "source_code",
      "source_description",
      "vorta_category",
      "is_corrective",
      "is_preventive",
      "is_calibration",
      "is_inspection",
      "is_refurbishment",
      "is_active",
    ];

    downloadTextFile(
      `${headers
        .map(escapeCsvCell)
        .join(",")}\r\n`,
      "sap-maintenance-type-mappings-template.csv",
    );
  };

const getRejectionFileName = (
  report: SapImportBatchReport,
): string => {
  const original =
    report.batch.file_name ??
    "sap-import";

  const baseName =
    original.replace(
      /\.[^.]+$/,
      "",
    );

  return `${baseName}-rejections.csv`;
};

const statusClassName = (
  status: string,
): string => {
  switch (
    status
      .trim()
      .toLowerCase()
  ) {
    case "completed":
    case "pass":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "partial":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "failed":
    case "fail":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "running":
    case "pending":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    default:
      return "border-gray-700 bg-gray-800/60 text-slate-300";
  }
};

const StatusBadge = ({
  status,
}: {
  status: string;
}): JSX.Element => (
  <span
    className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClassName(
      status,
    )}`}
  >
    {status}
  </span>
);

const InlineAlert = ({
  tone,
  title,
  children,
}: {
  tone:
    | "error"
    | "warning"
    | "success"
    | "info";

  title: string;
  children?: ReactNode;
}): JSX.Element => {
  const presentation = {
    error: {
      icon: XCircle,
      className:
        "border-red-500/30 bg-red-500/10 text-red-100",
    },

    warning: {
      icon: AlertCircle,
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-100",
    },

    success: {
      icon: CheckCircle2,
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    },

    info: {
      icon: ShieldCheck,
      className:
        "border-blue-500/30 bg-blue-500/10 text-blue-100",
    },
  }[tone];

  const Icon =
    presentation.icon;

  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 ${presentation.className}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />

      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {title}
        </p>

        {children ? (
          <div className="mt-1 text-xs leading-5 opacity-90">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const MetricCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): JSX.Element => (
  <div className="rounded-xl border border-gray-800 bg-[#0a0f17] p-4">
    <p className="text-xs font-medium text-slate-500">
      {label}
    </p>

    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
      {value}
    </p>
  </div>
);

export const SapDataImportSection =
  (): JSX.Element => {
    const fileInputRef =
      useRef<HTMLInputElement | null>(
        null,
      );

    const [
      bootstrap,
      setBootstrap,
    ] =
      useState<SapImportBootstrap | null>(
        null,
      );

    const [
      bootstrapError,
      setBootstrapError,
    ] = useState<string | null>(
      null,
    );

    const [
      isLoadingBootstrap,
      setIsLoadingBootstrap,
    ] = useState(true);

    const [
      selectedSiteId,
      setSelectedSiteId,
    ] = useState("");

    const [
      transactionCode,
      setTransactionCode,
    ] =
      useState<SapTransactionCode>(
        "IW39",
      );

    const [
      selectedFile,
      setSelectedFile,
    ] = useState<File | null>(
      null,
    );

    const [
      fileError,
      setFileError,
    ] = useState<string | null>(
      null,
    );

    const [
      preview,
      setPreview,
    ] =
      useState<SapCsvPreview | null>(
        null,
      );

    const [
      previewError,
      setPreviewError,
    ] = useState<string | null>(
      null,
    );

    const [
      isPreviewing,
      setIsPreviewing,
    ] = useState(false);

    const [
      result,
      setResult,
    ] =
      useState<SapImportExecutionResult | null>(
        null,
      );

    const [
      importError,
      setImportError,
    ] = useState<string | null>(
      null,
    );

    const [
      isImporting,
      setIsImporting,
    ] = useState(false);

    const [
      duplicateConfirmed,
      setDuplicateConfirmed,
    ] = useState(false);

    const [
      replaceStockSnapshot,
      setReplaceStockSnapshot,
    ] = useState(false);

    const [
      history,
      setHistory,
    ] = useState<
      SapImportHistoryItem[]
    >([]);

    const [
      historyError,
      setHistoryError,
    ] = useState<string | null>(
      null,
    );

    const [
      isLoadingHistory,
      setIsLoadingHistory,
    ] = useState(false);

    const [
      selectedReport,
      setSelectedReport,
    ] =
      useState<SapImportBatchReport | null>(
        null,
      );

    const [
      reportError,
      setReportError,
    ] = useState<string | null>(
      null,
    );

    const [
      isLoadingReport,
      setIsLoadingReport,
    ] = useState(false);

    const maxFileBytes =
      bootstrap?.limits
        .maxFileBytes ??
      DEFAULT_MAX_FILE_BYTES;

    const selectedSite =
      useMemo(
        () =>
          bootstrap?.sites.find(
            (site) =>
              site.id ===
              selectedSiteId,
          ) ?? null,
        [
          bootstrap,
          selectedSiteId,
        ],
      );

    const sampleColumns =
      useMemo(() => {
        if (
          !preview ||
          preview.sampleRows.length ===
            0
        ) {
          return [];
        }

        return Object.keys(
          preview.sampleRows[0],
        ).filter(
          (key) =>
            key !==
            "__source_row_number",
        );
      }, [preview]);

    const activeReport =
      selectedReport ??
      result?.report ??
      null;

    const rowValidationErrors =
      preview?.rowValidationErrors ??
      [];

    const ignoredHierarchyRowCount =
      preview?.ignoredHierarchyRowCount ??
      0;

    const rawDataRowCount =
      preview?.rawDataRowCount ??
      preview?.rowCount ??
      0;

    const isMb52Preview =
      preview?.transactionCode ===
      "MB52";

    const isMb52Result =
      result?.transactionCode ===
      "MB52";

    const stockScopes =
      preview?.snapshotScopes ??
      [];

    const matchedBomMaterialCount =
      preview?.matchedBomMaterialCount ??
      0;

    const unmatchedMaterialCount =
      preview?.unmatchedMaterialCount ??
      0;

    const unmatchedMaterialNumbers =
      preview?.unmatchedMaterialNumbers ??
      [];

    const validationPassed =
      Boolean(preview) &&
      preview!.missingRequiredFields
        .length === 0 &&
      preview!.structuralErrors
        .length === 0 &&
      rowValidationErrors.length ===
        0 &&
      preview!.unmappedCodes
        .length === 0;

    const duplicateReady =
      !preview?.duplicateImport ||
      duplicateConfirmed;

    const canImport =
      validationPassed &&
      duplicateReady &&
      Boolean(selectedFile) &&
      Boolean(selectedSiteId) &&
      !isImporting;

    const resetImportState =
      (): void => {
        setPreview(null);
        setPreviewError(null);
        setResult(null);
        setImportError(null);

        setDuplicateConfirmed(
          false,
        );

        setReplaceStockSnapshot(
          false,
        );

        setSelectedReport(null);
        setReportError(null);
      };

    const loadBootstrap =
      async (): Promise<void> => {
        setIsLoadingBootstrap(
          true,
        );

        setBootstrapError(null);

        try {
          const response =
            await getSapImportBootstrap();

          setBootstrap(response);

          const defaultSite =
            response.sites.find(
              (site) =>
                site.isDefault,
            ) ??
            response.sites[0];

          setSelectedSiteId(
            defaultSite?.id ??
              "",
          );
        } catch (error) {
          setBootstrapError(
            getErrorMessage(error),
          );
        } finally {
          setIsLoadingBootstrap(
            false,
          );
        }
      };

    const loadHistory =
      async (
        siteId: string,
      ): Promise<void> => {
        if (!siteId) {
          setHistory([]);
          return;
        }

        setIsLoadingHistory(
          true,
        );

        setHistoryError(null);

        try {
          const response =
            await getSapImportHistory(
              siteId,
              20,
            );

          setHistory(response);
        } catch (error) {
          setHistoryError(
            getErrorMessage(error),
          );
        } finally {
          setIsLoadingHistory(
            false,
          );
        }
      };

    useEffect(() => {
      void loadBootstrap();
    }, []);

    useEffect(() => {
      if (selectedSiteId) {
        void loadHistory(
          selectedSiteId,
        );
      }
    }, [selectedSiteId]);

    const applySelectedFile = (
      file: File | null,
    ): void => {
      setFileError(null);
      resetImportState();

      if (!file) {
        setSelectedFile(null);
        return;
      }

      if (
        !/\.(csv|txt)$/i.test(
          file.name,
        )
      ) {
        setSelectedFile(null);

        setFileError(
          "Select a .csv or .txt SAP export.",
        );

        return;
      }

      if (
        file.size <= 0 ||
        file.size > maxFileBytes
      ) {
        setSelectedFile(null);

        setFileError(
          `The file must be between 1 byte and ${formatBytes(
            maxFileBytes,
          )}.`,
        );

        return;
      }

      setSelectedFile(file);
    };

    const handleFileChange = (
      event: ChangeEvent<HTMLInputElement>,
    ): void => {
      applySelectedFile(
        event.target.files?.[0] ??
          null,
      );
    };

    const handleDrop = (
      event: DragEvent<HTMLDivElement>,
    ): void => {
      event.preventDefault();

      applySelectedFile(
        event.dataTransfer
          .files?.[0] ??
          null,
      );
    };

    const handleDropZoneKeyDown = (
      event: KeyboardEvent<HTMLDivElement>,
    ): void => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        fileInputRef.current?.click();
      }
    };

    const handlePreview =
      async (): Promise<void> => {
        if (
          !selectedFile ||
          !selectedSiteId
        ) {
          setPreviewError(
            "Select a site and CSV file first.",
          );

          return;
        }

        setIsPreviewing(true);
        setPreviewError(null);
        setImportError(null);
        setResult(null);
        setSelectedReport(null);

        setDuplicateConfirmed(
          false,
        );

        try {
          const response =
            await previewSapCsv({
              siteId:
                selectedSiteId,

              transactionCode,
              file: selectedFile,
              allowDuplicate: false,
              replaceSnapshot:
                replaceStockSnapshot,
            });

          setPreview(response);
        } catch (error) {
          if (
            error instanceof
              SapImportApiError &&
            isPreviewDetails(
              error.details,
            )
          ) {
            setPreview(
              error.details,
            );
          }

          setPreviewError(
            getErrorMessage(error),
          );
        } finally {
          setIsPreviewing(false);
        }
      };

    const handleImport =
      async (): Promise<void> => {
        if (
          !selectedFile ||
          !selectedSiteId ||
          !preview
        ) {
          setImportError(
            "Preview the CSV before importing it.",
          );

          return;
        }

        setIsImporting(true);
        setImportError(null);
        setResult(null);
        setSelectedReport(null);

        try {
          const response =
            await importSapCsv({
              siteId:
                selectedSiteId,

              transactionCode:
                preview
                  .transactionCode,

              file: selectedFile,

              allowDuplicate:
                duplicateConfirmed,

              replaceSnapshot:
                preview.transactionCode ===
                "MB52"
                  ? replaceStockSnapshot
                  : false,
            });

          setPreview(
            response.preview,
          );

          setResult(
            response.result,
          );

          setSelectedReport(
            response.result.report,
          );

          await loadHistory(
            selectedSiteId,
          );
        } catch (error) {
          if (
            error instanceof
              SapImportApiError &&
            isPreviewDetails(
              error.details,
            )
          ) {
            setPreview(
              error.details,
            );
          }

          setImportError(
            getErrorMessage(error),
          );
        } finally {
          setIsImporting(false);
        }
      };

    const handleLoadReport =
      async (
        batchId: string,
      ): Promise<void> => {
        if (!selectedSiteId) {
          return;
        }

        setIsLoadingReport(
          true,
        );

        setReportError(null);

        try {
          const report =
            await getSapImportReport(
              selectedSiteId,
              batchId,
            );

          setSelectedReport(report);
        } catch (error) {
          setReportError(
            getErrorMessage(error),
          );
        } finally {
          setIsLoadingReport(
            false,
          );
        }
      };

    const handleDownloadRejections =
      (): void => {
        if (
          !activeReport ||
          activeReport.rejections
            .length === 0
        ) {
          return;
        }

        downloadTextFile(
          createRejectionCsv(
            activeReport.rejections,
          ),
          getRejectionFileName(
            activeReport,
          ),
        );
      };

    if (isLoadingBootstrap) {
      return (
        <div className="flex min-h-[520px] items-center justify-center bg-[#090c12] text-slate-300">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading SAP import setup
        </div>
      );
    }

    if (
      bootstrapError ||
      !bootstrap
    ) {
      return (
        <div className="min-h-full bg-[#090c12] p-6 text-slate-100">
          <InlineAlert
            tone="error"
            title="SAP import setup could not be loaded"
          >
            {bootstrapError ??
              "No import configuration was returned."}
          </InlineAlert>

          <Button
            type="button"
            onClick={() =>
              void loadBootstrap()
            }
            className="mt-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      );
    }

    if (
      bootstrap.sites.length ===
      0
    ) {
      return (
        <div className="min-h-full bg-[#090c12] p-6 text-slate-100">
          <InlineAlert
            tone="error"
            title="No authorised import site"
          >
            Your account does not have Maintenance Manager import access to a site.
          </InlineAlert>
        </div>
      );
    }

    return (
      <div className="min-h-full bg-[#090c12] px-4 py-6 text-slate-100 md:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
          <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300">
                <Database className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  SAP Data Import
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Preview, validate and import SAP maintenance exports.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-gray-800 bg-[#0f141d] px-3 py-1.5">
                Maximum{" "}
                {formatBytes(
                  bootstrap.limits
                    .maxFileBytes,
                )}
              </span>

              <span className="rounded-full border border-gray-800 bg-[#0f141d] px-3 py-1.5">
                Maximum{" "}
                {bootstrap.limits.maxRows.toLocaleString(
                  "en-GB",
                )}{" "}
                rows
              </span>

              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
                Raw CSV not retained
              </span>
            </div>
          </header>

          <InlineAlert
            tone="info"
            title="SAP codes remain site-specific"
          >
            Order types such as PM01, notification types and maintenance activity types must be mapped for the selected site. Vorta will not guess their business meaning.
          </InlineAlert>

          <Card className="border-gray-800 bg-[#0f141d] shadow-none">
            <CardHeader className="border-b border-gray-800">
              <CardTitle className="text-base text-white">
                Upload maintenance data
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5 p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-medium text-slate-400">
                    Site
                  </span>

                  <select
                    value={
                      selectedSiteId
                    }
                    onChange={(
                      event,
                    ) => {
                      setSelectedSiteId(
                        event.target
                          .value,
                      );

                      resetImportState();
                    }}
                    className="h-10 w-full rounded-lg border border-gray-700 bg-[#0a0f17] px-3 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {bootstrap.sites.map(
                      (site) => (
                        <option
                          key={
                            site.id
                          }
                          value={
                            site.id
                          }
                        >
                          {site.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-medium text-slate-400">
                    SAP transaction
                  </span>

                  <select
                    value={
                      transactionCode
                    }
                    onChange={(
                      event,
                    ) => {
                      setTransactionCode(
                        event.target
                          .value as
                          SapTransactionCode,
                      );

                      resetImportState();
                    }}
                    className="h-10 w-full rounded-lg border border-gray-700 bg-[#0a0f17] px-3 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="AUTO">
                      Auto detect from headers
                    </option>

                    {bootstrap.transactions.map(
                      (
                        transaction,
                      ) => (
                        <option
                          key={
                            transaction.code
                          }
                          value={
                            transaction.code
                          }
                        >
                          {
                            transaction.label
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              {transactionCode ===
              "IH01" ? (
                <InlineAlert
                  tone="info"
                  title="IH01 imports equipment BOM relationships"
                >
                  IH01 assigns SAP material and spare-part numbers to equipment. BOM quantity is stored separately and will not overwrite warehouse stock, minimum stock, target stock, cost, lead time or availability.
                </InlineAlert>
              ) : null}

              {transactionCode ===
              "MB52" ? (
                <InlineAlert
                  tone="info"
                  title="MB52 imports warehouse stock"
                >
                  MB52 stores material stock by plant and storage location. Only unrestricted-use stock is treated as immediately available. Quality-inspection, blocked, returns and transfer stock remain visible but are not counted as usable spares.
                </InlineAlert>
              ) : null}

              {transactionCode ===
              "TYPE_MAPPING" ? (
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-medium text-blue-100">
                      SAP type mapping template
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-200/70">
                      Populate the site’s AUART, QMART, ILART and plan-category mappings before importing strict SAP data.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      downloadMappingTemplate
                    }
                    className="border-blue-500/30 bg-transparent text-blue-200 hover:bg-blue-500/10 hover:text-blue-100"
                  >
                    <Download className="h-4 w-4" />
                    Download template
                  </Button>
                </div>
              ) : null}

              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  fileInputRef.current?.click()
                }
                onKeyDown={
                  handleDropZoneKeyDown
                }
                onDragOver={(
                  event,
                ) =>
                  event.preventDefault()
                }
                onDrop={handleDrop}
                className="cursor-pointer rounded-xl border border-dashed border-gray-700 bg-[#0a0f17] p-8 text-center transition hover:border-blue-500/50 hover:bg-blue-500/[0.03] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={
                    handleFileChange
                  }
                />

                <UploadCloud className="mx-auto h-8 w-8 text-blue-400" />

                <p className="mt-3 text-sm font-medium text-slate-200">
                  Drop a SAP CSV here or select a file
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  CSV or text export, up to{" "}
                  {formatBytes(
                    maxFileBytes,
                  )}
                </p>
              </div>

              {selectedFile ? (
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-gray-800 bg-[#0a0f17] p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-400" />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {
                          selectedFile.name
                        }
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatBytes(
                          selectedFile.size,
                        )}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      applySelectedFile(
                        null,
                      );

                      if (
                        fileInputRef.current
                      ) {
                        fileInputRef.current.value =
                          "";
                      }
                    }}
                    className="text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  >
                    Remove
                  </Button>
                </div>
              ) : null}

              {fileError ? (
                <InlineAlert
                  tone="error"
                  title="Invalid file"
                >
                  {fileError}
                </InlineAlert>
              ) : null}

              <div className="flex flex-col justify-between gap-3 border-t border-gray-800 pt-5 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500">
                  Selected site:{" "}
                  <span className="font-medium text-slate-300">
                    {selectedSite?.name ??
                      "None"}
                  </span>
                </p>

                <Button
                  type="button"
                  disabled={
                    !selectedFile ||
                    !selectedSiteId ||
                    isPreviewing ||
                    isImporting
                  }
                  onClick={() =>
                    void handlePreview()
                  }
                  className="bg-blue-600 text-white hover:bg-blue-500"
                >
                  {isPreviewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}

                  {isPreviewing
                    ? "Previewing CSV"
                    : "Preview CSV"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {previewError ? (
            <InlineAlert
              tone="error"
              title="CSV preview failed"
            >
              {previewError}
            </InlineAlert>
          ) : null}

          {preview ? (
            <Card className="border-gray-800 bg-[#0f141d] shadow-none">
              <CardHeader className="border-b border-gray-800">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <CardTitle className="text-base text-white">
                    Import preview
                  </CardTitle>

                  <StatusBadge
                    status={
                      validationPassed
                        ? "pass"
                        : "fail"
                    }
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-5">
                <div
                  className={`grid gap-3 sm:grid-cols-2 ${
                    preview.transactionCode ===
                    "IH01"
                      ? "lg:grid-cols-5"
                      : "lg:grid-cols-4"
                  }`}
                >
                  <MetricCard
                    label="Detected transaction"
                    value={
                      preview.transactionCode
                    }
                  />

                  <MetricCard
                    label={
                      preview.transactionCode ===
                      "IH01"
                        ? "BOM component rows"
                        : preview.transactionCode ===
                          "MB52"
                          ? "Stock rows"
                          : "Data rows"
                    }
                    value={preview.rowCount.toLocaleString(
                      "en-GB",
                    )}
                  />

                  {preview.transactionCode ===
                  "IH01" ? (
                    <MetricCard
                      label="Hierarchy rows ignored"
                      value={ignoredHierarchyRowCount.toLocaleString(
                        "en-GB",
                      )}
                    />
                  ) : null}

                  <MetricCard
                    label="Delimiter"
                    value={
                      preview.delimiter
                    }
                  />

                  <MetricCard
                    label="Encoding"
                    value={
                      preview.encoding
                    }
                  />
                </div>

                {isMb52Preview ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard
                      label="BOM materials matched"
                      value={matchedBomMaterialCount.toLocaleString(
                        "en-GB",
                      )}
                    />

                    <MetricCard
                      label="Materials not in IH01"
                      value={unmatchedMaterialCount.toLocaleString(
                        "en-GB",
                      )}
                    />

                    <MetricCard
                      label="Plant / storage scopes"
                      value={stockScopes.length.toLocaleString(
                        "en-GB",
                      )}
                    />
                  </div>
                ) : null}

                {isMb52Preview &&
                stockScopes.length > 0 ? (
                  <InlineAlert
                    tone="info"
                    title="MB52 stock scopes detected"
                  >
                    {stockScopes
                      .map(
                        (scope) =>
                          `${scope.plantCode}/${scope.storageLocation}`,
                      )
                      .join(" · ")}
                  </InlineAlert>
                ) : null}

                {preview.transactionCode ===
                  "IH01" &&
                ignoredHierarchyRowCount >
                  0 ? (
                  <InlineAlert
                    tone="info"
                    title="IH01 hierarchy rows were ignored"
                  >
                    {ignoredHierarchyRowCount.toLocaleString(
                      "en-GB",
                    )}{" "}
                    of{" "}
                    {rawDataRowCount.toLocaleString(
                      "en-GB",
                    )}{" "}
                    source rows contained no material number. These were hierarchy or equipment structure rows rather than BOM components.
                  </InlineAlert>
                ) : null}

                {preview.missingRequiredFields
                  .length > 0 ? (
                  <InlineAlert
                    tone="error"
                    title="Required SAP columns are missing"
                  >
                    {preview.missingRequiredFields.join(
                      ", ",
                    )}
                  </InlineAlert>
                ) : null}

                {preview.structuralErrors
                  .length > 0 ? (
                  <InlineAlert
                    tone="error"
                    title="CSV row structure is invalid"
                  >
                    {preview.structuralErrors
                      .slice(0, 10)
                      .map(
                        (error) =>
                          `Row ${error.rowNumber}: expected ${error.expectedColumns} columns, received ${error.actualColumns}`,
                      )
                      .join(" · ")}
                  </InlineAlert>
                ) : null}

                {rowValidationErrors.length >
                0 ? (
                  <InlineAlert
                    tone="error"
                    title={
                      preview.transactionCode ===
                      "IH01"
                        ? "IH01 equipment references are invalid"
                        : preview.transactionCode ===
                          "MB52"
                          ? "MB52 stock rows are invalid"
                          : "CSV rows are invalid"
                    }
                  >
                    {rowValidationErrors
                      .slice(0, 20)
                      .map(
                        (error) =>
                          `Row ${error.rowNumber}: ${error.message}`,
                      )
                      .join(" · ")}
                  </InlineAlert>
                ) : null}

                {preview.unmappedCodes
                  .length > 0 ? (
                  <InlineAlert
                    tone="warning"
                    title="SAP type mappings are required"
                  >
                    {preview.unmappedCodes
                      .map(
                        (code) =>
                          `${code.objectType} ${code.sourceCode} (${code.affectedRows} rows)`,
                      )
                      .join(" · ")}
                  </InlineAlert>
                ) : null}

                {preview.unmappedHeaders
                  .length > 0 ? (
                  <InlineAlert
                    tone="info"
                    title="Unused CSV columns"
                  >
                    These columns are not required by the selected import contract and will be ignored:{" "}
                    {preview.unmappedHeaders.join(
                      ", ",
                    )}
                  </InlineAlert>
                ) : null}

                {isMb52Preview &&
                unmatchedMaterialCount > 0 ? (
                  <InlineAlert
                    tone="warning"
                    title="Some stock materials are not assigned by IH01"
                  >
                    <p>
                      {unmatchedMaterialCount.toLocaleString(
                        "en-GB",
                      )}{" "}
                      imported material numbers do not currently match an equipment BOM. Their stock will be retained, but no equipment spare will be updated until the material is assigned through IH01.
                    </p>

                    {unmatchedMaterialNumbers.length >
                    0 ? (
                      <p className="mt-2 font-mono">
                        {unmatchedMaterialNumbers
                          .slice(0, 20)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </InlineAlert>
                ) : null}

                {preview.duplicateImport ? (
                  <InlineAlert
                    tone="warning"
                    title="This exact file has already been imported"
                  >
                    <p>
                      Previous import:{" "}
                      {formatDateTime(
                        preview
                          .duplicateImport
                          .completedAt,
                      )}
                    </p>

                    <label className="mt-3 flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={
                          duplicateConfirmed
                        }
                        onChange={(
                          event,
                        ) =>
                          setDuplicateConfirmed(
                            event.target
                              .checked,
                          )
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600"
                      />

                      <span>
                        I understand this exact file has already been imported and want to process it again.
                      </span>
                    </label>
                  </InlineAlert>
                ) : null}

                {validationPassed ? (
                  <InlineAlert
                    tone="success"
                    title="CSV validation passed"
                  >
                    {preview.transactionCode ===
                    "IH01"
                      ? "The required columns, BOM component rows and site equipment references are valid."
                      : preview.transactionCode ===
                        "MB52"
                        ? "The required stock columns, material identifiers and SAP quantities are valid."
                        : "The required columns, row structure and site-specific SAP type mappings are valid."}
                  </InlineAlert>
                ) : null}

                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Column mapping
                  </h3>

                  <div className="mt-3 overflow-x-auto rounded-xl border border-gray-800">
                    <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                      <thead className="bg-[#0a0f17] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">
                            CSV column
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Vorta field
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {preview.mappedHeaders.map(
                          (
                            header,
                          ) => (
                            <tr
                              key={`${header.sourceHeader}-${header.canonicalField}`}
                              className="border-t border-gray-800"
                            >
                              <td className="px-4 py-3 text-slate-300">
                                {
                                  header.sourceHeader
                                }
                              </td>

                              <td className="px-4 py-3 font-mono text-blue-300">
                                {
                                  header.canonicalField
                                }
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {preview.sampleRows
                  .length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">
                      First{" "}
                      {preview.sampleRows
                        .length}{" "}
                      rows
                    </h3>

                    <div className="mt-3 overflow-x-auto rounded-xl border border-gray-800">
                      <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
                        <thead className="bg-[#0a0f17] text-slate-500">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-3 font-medium">
                              Row
                            </th>

                            {sampleColumns.map(
                              (
                                column,
                              ) => (
                                <th
                                  key={
                                    column
                                  }
                                  className="whitespace-nowrap px-3 py-3 font-medium"
                                >
                                  {
                                    column
                                  }
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {preview.sampleRows.map(
                            (
                              row,
                              rowIndex,
                            ) => (
                              <tr
                                key={
                                  rowIndex
                                }
                                className="border-t border-gray-800"
                              >
                                <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                                  {formatCellValue(
                                    row.__source_row_number,
                                  )}
                                </td>

                                {sampleColumns.map(
                                  (
                                    column,
                                  ) => (
                                    <td
                                      key={
                                        column
                                      }
                                      className="max-w-[260px] truncate whitespace-nowrap px-3 py-3 text-slate-300"
                                      title={formatCellValue(
                                        row[
                                          column
                                        ],
                                      )}
                                    >
                                      {formatCellValue(
                                        row[
                                          column
                                        ],
                                      )}
                                    </td>
                                  ),
                                )}
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {isMb52Preview ? (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={
                          replaceStockSnapshot
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setReplaceStockSnapshot(
                              event.target.checked,
                            )
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-900 text-amber-500"
                      />

                      <span>
                        <span className="block text-sm font-semibold text-amber-100">
                          Replace the current stock snapshot for the scopes in this file
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-amber-100/75">
                          When enabled, previously imported stock rows in the detected plant and storage-location scopes that are absent from this file will be removed. BOM parts with no remaining MB52 stock will become 0 / Out of Stock. Leave this unchecked for an incremental or filtered upload.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}

                <div className="flex flex-col justify-between gap-3 border-t border-gray-800 pt-5 sm:flex-row sm:items-center">
                  <p className="text-xs text-slate-500">
                    {preview.transactionCode ===
                    "IH01"
                      ? "Importing will update matching equipment-to-material BOM assignments while preserving existing warehouse stock values."
                      : preview.transactionCode ===
                        "MB52"
                        ? replaceStockSnapshot
                          ? "Importing will replace the confirmed plant and storage-location stock scopes, then recalculate linked equipment spare availability."
                          : "Importing will merge these stock rows into the material ledger and recalculate matching equipment spare availability."
                        : "Importing will update matching SAP records rather than create duplicates."}
                  </p>

                  <Button
                    type="button"
                    disabled={
                      !canImport
                    }
                    onClick={() =>
                      void handleImport()
                    }
                    className="bg-blue-600 text-white hover:bg-blue-500"
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}

                    {isImporting
                      ? "Importing SAP data"
                      : `Import ${preview.rowCount.toLocaleString(
                          "en-GB",
                        )} rows`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {importError ? (
            <InlineAlert
              tone="error"
              title="SAP import failed"
            >
              {importError}
            </InlineAlert>
          ) : null}

          {result ? (
            <Card className="border-emerald-500/20 bg-[#0f141d] shadow-none">
              <CardHeader className="border-b border-gray-800">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <CardTitle className="text-base text-white">
                      Import complete
                    </CardTitle>

                    <p className="mt-1 font-mono text-[11px] text-slate-500">
                      Batch{" "}
                      {result.batchId}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      result.rejectedCount >
                      0
                        ? "partial"
                        : "completed"
                    }
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-5 p-5">
                <div
                  className={`grid gap-3 sm:grid-cols-2 ${
                    result.transactionCode ===
                    "IH01"
                      ? "lg:grid-cols-5"
                      : "lg:grid-cols-4"
                  }`}
                >
                  <MetricCard
                    label="Accepted"
                    value={
                      result.acceptedCount
                    }
                  />

                  <MetricCard
                    label="Rejected"
                    value={
                      result.rejectedCount
                    }
                  />

                  <MetricCard
                    label="Inserted"
                    value={
                      result.insertedCount
                    }
                  />

                  <MetricCard
                    label="Updated"
                    value={
                      result.updatedCount
                    }
                  />

                  {result.transactionCode ===
                  "IH01" ? (
                    <MetricCard
                      label="Hierarchy rows ignored"
                      value={
                        result.ignoredHierarchyRowCount ??
                        0
                      }
                    />
                  ) : null}
                </div>

                {isMb52Result ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <MetricCard
                      label="Equipment spares updated"
                      value={
                        result.synchronisedComponentCount ??
                          0
                      }
                    />

                    <MetricCard
                      label="BOM materials matched"
                      value={
                        result.matchedBomMaterialCount ??
                          0
                      }
                    />

                    <MetricCard
                      label="Materials not in IH01"
                      value={
                        result.unmatchedMaterialCount ??
                          0
                      }
                    />

                    <MetricCard
                      label="BOM parts without stock"
                      value={
                        result.bomMaterialsWithoutStockCount ??
                          0
                      }
                    />

                    <MetricCard
                      label="Stale stock rows removed"
                      value={
                        result.deletedStockRows ??
                          0
                      }
                    />
                  </div>
                ) : null}

                {isMb52Result ? (
                  result.snapshotReplaced ? (
                    <InlineAlert
                      tone="success"
                      title="Stock snapshot replaced"
                    >
                      The confirmed plant and storage-location scopes were refreshed and stale stock rows were removed before equipment spare availability was recalculated.
                    </InlineAlert>
                  ) : (
                    <InlineAlert
                      tone="info"
                      title="Stock rows merged"
                    >
                      Existing stock rows that were not included in this upload were retained. Matching equipment spare availability was recalculated from the current material ledger.
                    </InlineAlert>
                  )
                ) : null}

                {result.riskRefreshed ? (
                  <InlineAlert
                    tone="success"
                    title="Risk calculations refreshed"
                  >
                    The operational dashboard has been recalculated using the accepted SAP data.
                  </InlineAlert>
                ) : result.riskRefreshError ? (
                  <InlineAlert
                    tone="warning"
                    title="Import succeeded but risk refresh failed"
                  >
                    {
                      result.riskRefreshError
                    }
                  </InlineAlert>
                ) : null}

                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    SAP integrity checks
                  </h3>

                  <div className="mt-3 grid gap-2">
                    {result.integrity.map(
                      (
                        check,
                      ) => (
                        <div
                          key={
                            check.check_key
                          }
                          className="flex flex-col justify-between gap-3 rounded-xl border border-gray-800 bg-[#0a0f17] p-4 sm:flex-row sm:items-center"
                        >
                          <div>
                            <p className="text-xs font-medium capitalize text-slate-200">
                              {check.check_key.replace(
                                /_/g,
                                " ",
                              )}
                            </p>

                            <p className="mt-1 text-[11px] leading-5 text-slate-500">
                              {
                                check.detail
                              }
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs tabular-nums text-slate-500">
                              {
                                check.actual_count
                              }
                            </span>

                            <StatusBadge
                              status={
                                check.status
                              }
                            />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-gray-800 bg-[#0f141d] shadow-none">
            <CardHeader className="border-b border-gray-800">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-400" />

                  <CardTitle className="text-base text-white">
                    Import history
                  </CardTitle>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={
                    !selectedSiteId ||
                    isLoadingHistory
                  }
                  onClick={() =>
                    void loadHistory(
                      selectedSiteId,
                    )
                  }
                  className="text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      isLoadingHistory
                        ? "animate-spin"
                        : ""
                    }`}
                  />

                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              {historyError ? (
                <InlineAlert
                  tone="error"
                  title="Import history could not be loaded"
                >
                  {historyError}
                </InlineAlert>
              ) : null}

              {isLoadingHistory &&
              history.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  Loading import history
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-800 py-12 text-center">
                  <Database className="mx-auto h-6 w-6 text-slate-600" />

                  <p className="mt-3 text-sm text-slate-400">
                    No SAP imports have been recorded for this site.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                    <thead className="bg-[#0a0f17] text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          File
                        </th>

                        <th className="px-4 py-3 font-medium">
                          Transaction
                        </th>

                        <th className="px-4 py-3 font-medium">
                          Uploaded
                        </th>

                        <th className="px-4 py-3 font-medium">
                          Status
                        </th>

                        <th className="px-4 py-3 text-right font-medium">
                          Accepted
                        </th>

                        <th className="px-4 py-3 text-right font-medium">
                          Rejected
                        </th>

                        <th className="px-4 py-3 font-medium">
                          Uploaded by
                        </th>

                        <th className="px-4 py-3 text-right font-medium">
                          Report
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {history.map(
                        (
                          item,
                        ) => {
                          const metadataEmail =
                            typeof item
                              .metadata
                              .uploadedByEmail ===
                            "string"
                              ? item
                                  .metadata
                                  .uploadedByEmail
                              : null;

                          const uploadedBy =
                            item.uploadedByName ??
                            metadataEmail ??
                            "Unknown user";

                          return (
                            <tr
                              key={
                                item.id
                              }
                              className="border-t border-gray-800"
                            >
                              <td className="max-w-[260px] truncate px-4 py-3 font-medium text-slate-200">
                                {item.fileName ??
                                  "Unnamed file"}
                              </td>

                              <td className="px-4 py-3 font-mono text-blue-300">
                                {item.transactionCode ??
                                  "—"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                                {formatDateTime(
                                  item.startedAt,
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <StatusBadge
                                  status={
                                    item.status
                                  }
                                />
                              </td>

                              <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                                {
                                  item.acceptedCount
                                }
                              </td>

                              <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                                {
                                  item.rejectedCount
                                }
                              </td>

                              <td className="max-w-[220px] truncate px-4 py-3 text-slate-400">
                                {
                                  uploadedBy
                                }
                              </td>

                              <td className="px-4 py-3 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={
                                    isLoadingReport
                                  }
                                  onClick={() =>
                                    void handleLoadReport(
                                      item.id,
                                    )
                                  }
                                  className="text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"
                                >
                                  View report
                                </Button>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {reportError ? (
            <InlineAlert
              tone="error"
              title="Import report could not be loaded"
            >
              {reportError}
            </InlineAlert>
          ) : null}

          {isLoadingReport ? (
            <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-[#0f141d] py-12 text-sm text-slate-400">
              <Loader2 className="mr-3 h-4 w-4 animate-spin" />
              Loading import report
            </div>
          ) : null}

          {activeReport &&
          !isLoadingReport ? (
            <Card className="border-gray-800 bg-[#0f141d] shadow-none">
              <CardHeader className="border-b border-gray-800">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <CardTitle className="text-base text-white">
                      Import report
                    </CardTitle>

                    <p className="mt-1 text-xs text-slate-500">
                      {activeReport.batch
                        .file_name ??
                        "Unnamed file"}{" "}
                      ·{" "}
                      {formatDateTime(
                        activeReport.batch
                          .completed_at,
                      )}
                    </p>
                  </div>

                  {activeReport.rejections
                    .length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={
                        handleDownloadRejections
                      }
                      className="border-gray-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      <Download className="h-4 w-4" />
                      Download rejections CSV
                    </Button>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="space-y-5 p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="Rows"
                    value={
                      activeReport.batch
                        .row_count
                    }
                  />

                  <MetricCard
                    label="Accepted"
                    value={
                      activeReport.batch
                        .accepted_count
                    }
                  />

                  <MetricCard
                    label="Rejected"
                    value={
                      activeReport.batch
                        .rejected_count
                    }
                  />
                </div>

                {activeReport.rejections
                  .length === 0 ? (
                  <InlineAlert
                    tone="success"
                    title="No rejected rows"
                  >
                    Every row in this batch passed validation.
                  </InlineAlert>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-800">
                    <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                      <thead className="bg-[#0a0f17] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">
                            Row
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Record
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Entity
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Error
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Explanation
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {activeReport.rejections.map(
                          (
                            rejection,
                          ) => (
                            <tr
                              key={
                                rejection.id
                              }
                              className="border-t border-gray-800"
                            >
                              <td className="px-4 py-3 tabular-nums text-slate-400">
                                {rejection.sourceRowNumber ??
                                  "—"}
                              </td>

                              <td className="px-4 py-3 font-mono text-slate-300">
                                {rejection.sourceRecordKey ??
                                  "—"}
                              </td>

                              <td className="px-4 py-3 text-slate-400">
                                {
                                  rejection.entityType
                                }
                              </td>

                              <td className="px-4 py-3 font-mono text-red-300">
                                {
                                  rejection.errorCode
                                }
                              </td>

                              <td className="max-w-[420px] px-4 py-3 leading-5 text-slate-300">
                                {
                                  rejection.errorMessage
                                }
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    );
  };
