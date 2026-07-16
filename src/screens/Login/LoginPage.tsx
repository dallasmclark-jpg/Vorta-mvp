import { useEffect, useState } from "react";
import {
  Building2,
  ClipboardList,
  Eye,
  EyeOff,
  Factory,
  HardHat,
  LayoutDashboard,
  User,
} from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  getRememberSession,
  setRememberSession,
  supabase,
} from "../../lib/supabaseClient";
import {
  canAccessPath,
  roleHomePath,
  useAuth,
} from "../../lib/auth";
import { VortaIcon, VortaLogo } from "../../components/VortaLogo";

function LinkedInIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      fill="#ffffff"
    >
      <path
        d="M0 1.292C0 .578.592 0 1.322 0h15.356C17.408 0 18 .578 18 1.292v15.416C18 17.422 17.408 18 16.678 18H1.322C.592 18 0 17.422 0 16.708V1.292z"
        fill="#0A66C2"
      />
      <path
        d="M5.452 15.168V6.953H2.694v8.215H5.452zm-1.38-9.336c.962 0 1.56-.638 1.56-1.434-.018-.814-.598-1.434-1.542-1.434-.944 0-1.56.62-1.56 1.434 0 .796.598 1.434 1.524 1.434h.018zM9.738 15.168V10.57c0-.248.018-.496.09-.674.201-.495.655-1.009 1.42-1.009.999 0 1.398.761 1.398 1.879v4.402h2.757V10.43c0-2.549-1.362-3.733-3.177-3.733-1.489 0-2.143.831-2.506 1.397h.018V6.953H6.98c.036.779 0 8.215 0 8.215h2.758z"
        fill="#ffffff"
      />
    </svg>
  );
}

function TopNav() {
  return (
    <header className="flex h-16 w-full items-center border-b border-gray-800 bg-[#090b10] px-6 md:px-10">
      <a
        href="/"
        aria-label="Vorta home"
        className="flex shrink-0 select-none items-center gap-2"
      >
        <VortaLogo />
      </a>
    </header>
  );
}

type DemoPortalPath =
  | "/dashboard"
  | "/engineer/dashboard"
  | "/contractor/dashboard"
  | "/production/dashboard"
  | "/operator/dashboard"
  | "/planner/planner-dashboard";

interface PortalOption {
  path: DemoPortalPath;
  label: string;
  Icon: typeof LayoutDashboard;
  activeClass: string;
  idleClass: string;
  iconClass: string;
}

const PORTAL_OPTIONS: PortalOption[] = [
  {
    path: "/dashboard",
    label: "Maintenance Manager",
    Icon: LayoutDashboard,
    activeClass: "border-[#3b82f645] bg-[#3b82f612]",
    idleClass:
      "border-[#3b82f625] bg-[#3b82f608] hover:border-[#3b82f645] hover:bg-[#3b82f612]",
    iconClass: "text-blue-400",
  },
  {
    path: "/engineer/dashboard",
    label: "Engineer",
    Icon: User,
    activeClass: "border-[#10b98145] bg-[#10b98112]",
    idleClass:
      "border-[#10b98125] bg-[#10b98108] hover:border-[#10b98145] hover:bg-[#10b98112]",
    iconClass: "text-emerald-400",
  },
  {
    path: "/contractor/dashboard",
    label: "Contractor",
    Icon: Building2,
    activeClass: "border-[#3b82f645] bg-[#3b82f612]",
    idleClass:
      "border-[#3b82f625] bg-[#3b82f608] hover:border-[#3b82f645] hover:bg-[#3b82f612]",
    iconClass: "text-blue-400",
  },
  {
    path: "/production/dashboard",
    label: "Production Manager",
    Icon: Factory,
    activeClass: "border-[#f9731645] bg-[#f9731612]",
    idleClass:
      "border-[#f9731625] bg-[#f9731608] hover:border-[#f9731645] hover:bg-[#f9731612]",
    iconClass: "text-orange-400",
  },
  {
    path: "/operator/dashboard",
    label: "Operator",
    Icon: HardHat,
    activeClass: "border-[#10b98145] bg-[#10b98112]",
    idleClass:
      "border-[#10b98125] bg-[#10b98108] hover:border-[#10b98145] hover:bg-[#10b98112]",
    iconClass: "text-emerald-400",
  },
  {
    path: "/planner/planner-dashboard",
    label: "Maintenance Planner",
    Icon: ClipboardList,
    activeClass: "border-[#3b82f645] bg-[#3b82f612]",
    idleClass:
      "border-[#3b82f625] bg-[#3b82f608] hover:border-[#3b82f645] hover:bg-[#3b82f612]",
    iconClass: "text-blue-400",
  },
];

const AUTH_ACTION_TIMEOUT_MS = 15_000;

function withLoginActionTimeout<T>(
  request: PromiseLike<T>,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, AUTH_ACTION_TIMEOUT_MS);

    Promise.resolve(request).then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function authenticationActionError(
  error: unknown,
  timeoutMessage: string,
): string {
  if (error instanceof Error && error.message === timeoutMessage) {
    return timeoutMessage;
  }

  return "Vorta could not contact the secure authentication service. Check the network connection and try again.";
}

export const LoginPage = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    session,
    role,
    siteContext,
    isDemoAdmin,
    loading,
    roleResolutionFailed,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(getRememberSession());
  const [submitting, setSubmitting] = useState(false);
  const [selectedPortal, setSelectedPortal] =
    useState<DemoPortalPath | null>(null);
  const [error, setError] = useState<string | null>(
    (location.state as { authError?: string } | null)?.authError ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [successMessage] = useState<string | null>(
    (location.state as { successMessage?: string } | null)?.successMessage ??
      null,
  );
  const [sendingReset, setSendingReset] = useState(false);
  const [submittingLinkedIn, setSubmittingLinkedIn] = useState(false);

  const from = (
    location.state as { from?: { pathname: string } } | null
  )?.from?.pathname;

  const hasResolvedAccess = Boolean(
    session &&
      role &&
      (isDemoAdmin || role === "vorta_admin" || siteContext),
  );

  useEffect(() => {
    if (
      loading ||
      !session ||
      hasResolvedAccess ||
      roleResolutionFailed
    ) {
      return;
    }

    const accessError = !role
      ? "Your account does not have a supported Vorta portal role. Contact your Vorta administrator."
      : "Your account does not have an active Vorta site assignment. Contact your Vorta administrator.";

    setError(accessError);
    setNotice(null);

    void supabase.auth.signOut().catch((signOutError: unknown) => {
      console.warn(
        "Vorta could not clear an unauthorised login session.",
        signOutError,
      );
    });
  }, [
    hasResolvedAccess,
    loading,
    role,
    roleResolutionFailed,
    session,
  ]);

  if (!loading && hasResolvedAccess && session && role) {
    const requestedPath = selectedPortal ?? from;
    const destination =
      requestedPath && canAccessPath(role, requestedPath, isDemoAdmin)
        ? requestedPath
        : roleHomePath(role);

    return <Navigate to={destination} replace />;
  }

  const handlePortalSelection = (
    portal: DemoPortalPath,
    portalLabel: string,
  ) => {
    setError(null);
    setNotice(null);
    setSelectedPortal(portal);

    if (hasResolvedAccess && role && isDemoAdmin) {
      navigate(portal);
      return;
    }

    setNotice(
      `Sign in with an authorised account to open the ${portalLabel} portal.`,
    );
  };

  const handleSignIn = async (
    event: React.FormEvent,
  ): Promise<void> => {
    event.preventDefault();

    if (submitting || sendingReset || submittingLinkedIn) {
      return;
    }

    const normalisedEmail = email.trim();
    if (!normalisedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    const timeoutMessage =
      "Vorta could not complete sign-in within 15 seconds.";

    setError(null);
    setNotice(null);
    setSubmitting(true);
    setRememberSession(remember);

    try {
      const { error: authError } = await withLoginActionTimeout(
        supabase.auth.signInWithPassword({
          email: normalisedEmail,
          password,
        }),
        timeoutMessage,
      );

      if (authError) {
        setError(authError.message);
        return;
      }

      setNotice("Sign-in accepted. Verifying your role and site access…");
    } catch (signInError) {
      console.warn("Vorta sign-in request failed.", signInError);
      setError(authenticationActionError(signInError, timeoutMessage));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (sendingReset || submitting || submittingLinkedIn) {
      return;
    }

    const normalisedEmail = email.trim();
    setError(null);
    setNotice(null);

    if (!normalisedEmail) {
      setError("Enter your email address first.");
      return;
    }

    const timeoutMessage =
      "Vorta could not request a password-reset email within 15 seconds.";
    setSendingReset(true);

    try {
      const { error: resetError } = await withLoginActionTimeout(
        supabase.auth.resetPasswordForEmail(normalisedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
        timeoutMessage,
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setNotice(
        "If an account exists for that email address, a password reset link has been sent.",
      );
    } catch (resetRequestError) {
      console.warn("Vorta password-reset request failed.", resetRequestError);
      setError(
        authenticationActionError(resetRequestError, timeoutMessage),
      );
    } finally {
      setSendingReset(false);
    }
  };

  const handleSignUpRequest = () => {
    setError(null);
    setNotice(
      "Vorta pilot access is currently invitation-only. Contact your Vorta administrator or pilot lead to request access.",
    );
  };

  const handleLinkedIn = async (): Promise<void> => {
    if (submittingLinkedIn || submitting || sendingReset) {
      return;
    }

    const timeoutMessage =
      "Vorta could not start LinkedIn authentication within 15 seconds.";

    setError(null);
    setNotice(null);
    setRememberSession(remember);
    setSubmittingLinkedIn(true);

    try {
      const { error: authError } = await withLoginActionTimeout(
        supabase.auth.signInWithOAuth({
          provider: "linkedin_oidc",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        }),
        timeoutMessage,
      );

      if (authError) {
        setError(authError.message);
      }
    } catch (linkedInError) {
      console.warn(
        "Vorta LinkedIn authentication request failed.",
        linkedInError,
      );
      setError(authenticationActionError(linkedInError, timeoutMessage));
    } finally {
      setSubmittingLinkedIn(false);
    }
  };

  const verifyingAccess = Boolean(session && loading);
  const formDisabled =
    submitting || sendingReset || submittingLinkedIn || verifyingAccess;

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e14]">
      <TopNav />

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-[400px] flex-col items-center">
          <div className="mb-6">
            <VortaIcon className="h-10 w-[72px]" />
          </div>

          <h1 className="mb-2 text-center text-[28px] font-semibold leading-tight text-white">
            Log in to your account
          </h1>
          <p className="mb-8 text-center text-sm text-slate-400">
            Welcome back! Please enter your details.
          </p>

          <div className="mb-6 flex w-full rounded-lg border border-gray-800 bg-[#141820] p-1">
            <button
              type="button"
              onClick={handleSignUpRequest}
              className="flex-1 rounded-md py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Sign up
            </button>
            <button
              type="button"
              className="flex-1 rounded-md bg-[#1e2535] py-2 text-sm font-semibold text-slate-50"
            >
              Log in
            </button>
          </div>

          <form onSubmit={handleSignIn} noValidate className="w-full space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={formDisabled}
                className="h-11 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={formDisabled}
                  className="h-11 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3.5 pr-11 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  tabIndex={-1}
                  disabled={formDisabled}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-60"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="remember"
                className="flex cursor-pointer select-none items-center gap-2"
              >
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  disabled={formDisabled}
                  className="h-4 w-4 cursor-pointer rounded border-gray-700 bg-[#0b0e14] accent-blue-600"
                />
                <span className="text-sm text-slate-300">Remember me</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={formDisabled}
                className="text-sm font-semibold text-slate-300 transition-colors hover:text-white disabled:opacity-60"
              >
                {sendingReset ? "Sending…" : "Forgot password"}
              </button>
            </div>

            {successMessage && (
              <div className="rounded-lg border border-emerald-500/20 bg-[#10b98108] px-3.5 py-2.5 text-sm text-emerald-400">
                {successMessage}
              </div>
            )}

            {notice && (
              <div className="rounded-lg border border-blue-500/20 bg-[#3b82f608] px-3.5 py-2.5 text-sm text-blue-300">
                {notice}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-[#ef444408] px-3.5 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={formDisabled}
              className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-70"
            >
              {submitting || verifyingAccess ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  {verifyingAccess ? "Verifying access…" : "Signing in…"}
                </span>
              ) : (
                "Sign in"
              )}
            </button>

            <button
              type="button"
              onClick={handleLinkedIn}
              disabled={formDisabled}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-gray-700 bg-transparent text-sm font-semibold text-slate-300 transition-colors hover:bg-[#ffffff08] hover:text-slate-50 disabled:opacity-70"
            >
              {submittingLinkedIn ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              ) : (
                <LinkedInIcon />
              )}
              {submittingLinkedIn
                ? "Redirecting…"
                : "Sign in with LinkedIn"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={handleSignUpRequest}
              className="font-semibold text-slate-300 transition-colors hover:text-white"
            >
              Sign up
            </button>
          </p>

          <div className="mt-8 w-full border-t border-gray-800 pt-6">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-slate-600">
              Demo Portal Access
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PORTAL_OPTIONS.map(
                ({
                  path,
                  label,
                  Icon,
                  activeClass,
                  idleClass,
                  iconClass,
                }) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handlePortalSelection(path, label)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 transition-colors ${
                      selectedPortal === path ? activeClass : idleClass
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${iconClass}`} />
                    <span className="text-center text-[11px] font-semibold leading-snug text-slate-300">
                      {label}
                    </span>
                    <span className="text-center text-[10px] text-slate-600">
                      Select portal
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
