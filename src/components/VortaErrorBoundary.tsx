import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Home,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "react-router-dom";

export type VortaErrorBoundaryScope =
  | "application"
  | "portal";

interface VortaErrorBoundaryProps {
  children: ReactNode;
  scope?: VortaErrorBoundaryScope;
  resetKey?: string;
}

interface VortaErrorBoundaryState {
  hasError: boolean;
  errorReference: string;
}

function createErrorReference(): string {
  const timestamp = Date.now()
    .toString(36)
    .toUpperCase();

  const randomPart = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `VRT-${timestamp}-${randomPart}`;
}

function createInitialState(): VortaErrorBoundaryState {
  return {
    hasError: false,
    errorReference: createErrorReference(),
  };
}

export class VortaErrorBoundary extends Component<
  VortaErrorBoundaryProps,
  VortaErrorBoundaryState
> {
  public state: VortaErrorBoundaryState =
    createInitialState();

  public static getDerivedStateFromError(): Partial<VortaErrorBoundaryState> {
    return {
      hasError: true,
    };
  }

  public componentDidCatch(
    error: Error,
    errorInfo: ErrorInfo,
  ): void {
    const scope =
      this.props.scope ?? "application";

    const pathname =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "unknown";

    const diagnostic = {
      reference: this.state.errorReference,
      scope,
      pathname,
      message: error.message,
      stack: error.stack ?? null,
      componentStack:
        errorInfo.componentStack ?? null,
      occurredAt: new Date().toISOString(),
    };

    console.error(
      "Vorta render failure",
      diagnostic,
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(
          "vorta:render-error",
          {
            detail: diagnostic,
          },
        ),
      );
    }
  }

  public componentDidUpdate(
    previousProps: VortaErrorBoundaryProps,
  ): void {
    if (
      this.state.hasError &&
      previousProps.resetKey !==
        this.props.resetKey
    ) {
      this.setState(createInitialState());
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReturnToDashboard = (): void => {
    window.location.assign("/dashboard");
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const scope =
      this.props.scope ?? "application";

    const isApplicationFailure =
      scope === "application";

    const title = isApplicationFailure
      ? "Vorta could not start"
      : "This workspace could not load";

    const description = isApplicationFailure
      ? "An unexpected application error prevented Vorta from loading. Reload the application to restore the current session."
      : "An unexpected error affected this section of Vorta. Your operational data has not been changed.";

    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#0b0f14] p-5 text-slate-100 sm:p-8"
        role="alert"
        aria-live="assertive"
        data-error-reference={
          this.state.errorReference
        }
      >
        <section className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700/70 bg-[#121821] shadow-2xl shadow-black/40">
          <div className="border-b border-slate-800 bg-[#10161e] px-6 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10">
                <AlertTriangle
                  className="size-5 text-amber-300"
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-400">
                  Vorta system notice
                </p>

                <h1 className="mt-1 text-xl font-semibold text-slate-50">
                  {title}
                </h1>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
            <p className="max-w-lg text-sm leading-6 text-slate-300">
              {description}
            </p>

            <div className="rounded-xl border border-slate-700/70 bg-[#0d131b] px-4 py-3">
              <p className="text-xs font-medium text-slate-400">
                Error reference
              </p>

              <p className="mt-1 break-all font-mono text-sm text-slate-200">
                {this.state.errorReference}
              </p>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Keep this reference when reporting the
              issue so the failure can be matched to
              the application logs.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121821]"
              >
                <RefreshCw
                  className="size-4"
                  aria-hidden="true"
                />
                Reload Vorta
              </button>

              <button
                type="button"
                onClick={
                  this.handleReturnToDashboard
                }
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121821]"
              >
                <Home
                  className="size-4"
                  aria-hidden="true"
                />
                Return to dashboard
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }
}

export function VortaRouteErrorBoundary({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const location = useLocation();

  const resetKey =
    `${location.pathname}${location.search}`;

  return (
    <VortaErrorBoundary
      scope="portal"
      resetKey={resetKey}
    >
      {children}
    </VortaErrorBoundary>
  );
}
