import { useState } from "react";
import { Building2, Eye, EyeOff, Factory, HardHat, LayoutDashboard, User } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { VortaLogo, VortaIcon } from "../../components/VortaLogo";
// ─── LinkedIn logo SVG (official mark, white) ─────────────────────────────────

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="#ffffff">
      <path d="M0 1.292C0 .578.592 0 1.322 0h15.356C17.408 0 18 .578 18 1.292v15.416C18 17.422 17.408 18 16.678 18H1.322C.592 18 0 17.422 0 16.708V1.292z" fill="#0A66C2"/>
      <path d="M5.452 15.168V6.953H2.694v8.215H5.452zm-1.38-9.336c.962 0 1.56-.638 1.56-1.434-.018-.814-.598-1.434-1.542-1.434-.944 0-1.56.62-1.56 1.434 0 .796.598 1.434 1.524 1.434h.018zM9.738 15.168V10.57c0-.248.018-.496.09-.674.201-.495.655-1.009 1.42-1.009.999 0 1.398.761 1.398 1.879v4.402h2.757V10.43c0-2.549-1.362-3.733-3.177-3.733-1.489 0-2.143.831-2.506 1.397h.018V6.953H6.98c.036.779 0 8.215 0 8.215h2.758z" fill="#ffffff"/>
    </svg>
  );
}

// ─── Top navigation bar ───────────────────────────────────────────────────────

function TopNav() {
  return (
    <header className="flex h-16 w-full items-center border-b border-gray-800 bg-[#090b10] px-6 md:px-10">
      <a href="/" aria-label="Vorta home" className="flex items-center gap-2 select-none shrink-0">
        <VortaLogo />
      </a>
    </header>
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────

export const LoginPage = (): JSX.Element => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { session, loading } = useAuth();

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember,     setRemember]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const [submittingLinkedIn, setSubmittingLinkedIn] = useState(false);

  // Redirect only when arriving via RequireAuth (i.e. a protected route sent the user here)
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
  if (!loading && session && from) return <Navigate to={from} replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setError(null);
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }
    // TODO: Implement role-based routing once user profiles (e.g. profiles.role) are available.
    navigate(from ?? "/dashboard", { replace: true });
  };

  const handleLinkedIn = async () => {
    setSubmittingLinkedIn(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setError(authError.message);
      setSubmittingLinkedIn(false);
    }
    // On success the browser redirects — no further action needed
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e14]">
      <TopNav />

      {/* ── Centered content ──────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-[400px] flex-col items-center">

          {/* Vorta icon mark */}
          <div className="mb-6">
            <VortaIcon className="w-[72px] h-10" />
          </div>

          {/* Heading */}
          <h1 className="mb-2 text-center text-[28px] font-semibold leading-tight text-white">
            Log in to your account
          </h1>
          <p className="mb-8 text-center text-sm text-slate-400">
            Welcome back! Please enter your details.
          </p>

          {/* Sign up / Log in toggle */}
          <div className="mb-6 flex w-full rounded-lg bg-[#141820] p-1 border border-gray-800">
            <button
              type="button"
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

          {/* Form */}
          <form onSubmit={handleSignIn} noValidate className="w-full space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3.5 pr-11 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 select-none">
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-gray-700 bg-[#0b0e14] accent-blue-600"
                />
                <span className="text-sm text-slate-300">Remember for 30 days</span>
              </label>
              <button type="button" className="text-sm font-semibold text-slate-300 transition-colors hover:text-white">
                Forgot password
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-[#ef444408] px-3.5 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Sign in */}
            <button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-70"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>

            {/* LinkedIn SSO */}
            <button
              type="button"
              onClick={handleLinkedIn}
              disabled={submittingLinkedIn}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-gray-700 bg-transparent text-sm font-semibold text-slate-300 transition-colors hover:bg-[#ffffff08] hover:text-slate-50 disabled:opacity-70"
            >
              {submittingLinkedIn ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <LinkedInIcon />
              )}
              {submittingLinkedIn ? "Redirecting…" : "Sign in with LinkedIn"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <button type="button" className="font-semibold text-slate-300 transition-colors hover:text-white">
              Sign up
            </button>
          </p>

          {/* Demo access */}
          <div className="mt-8 w-full border-t border-gray-800 pt-6">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-slate-600">
              MVP Demo Access
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-[#3b82f625] bg-[#3b82f608] px-3 py-3 transition-colors hover:border-[#3b82f645] hover:bg-[#3b82f612]"
              >
                <LayoutDashboard className="h-4 w-4 text-blue-400" />
                <span className="text-[11px] font-semibold text-slate-300 leading-snug text-center">Maintenance Manager</span>
                <span className="text-[10px] text-slate-600 text-center">View demo</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/engineer/dashboard")}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-[#10b98125] bg-[#10b98108] px-3 py-3 transition-colors hover:border-[#10b98145] hover:bg-[#10b98112]"
              >
                <User className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] font-semibold text-slate-300 leading-snug text-center">Engineer</span>
                <span className="text-[10px] text-slate-600 text-center">View demo</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/contractor/dashboard")}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-[#3b82f625] bg-[#3b82f608] px-3 py-3 transition-colors hover:border-[#3b82f645] hover:bg-[#3b82f612]"
              >
                <Building2 className="h-4 w-4 text-blue-400" />
                <span className="text-[11px] font-semibold text-slate-300 leading-snug text-center">Contractor</span>
                <span className="text-[10px] text-slate-600 text-center">View demo</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/production/dashboard")}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-[#f9731625] bg-[#f9731608] px-3 py-3 transition-colors hover:border-[#f9731645] hover:bg-[#f9731612]"
              >
                <Factory className="h-4 w-4 text-orange-400" />
                <span className="text-[11px] font-semibold text-slate-300 leading-snug text-center">Production Manager</span>
                <span className="text-[10px] text-slate-600 text-center">View demo</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/operator/dashboard")}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-[#10b98125] bg-[#10b98108] px-3 py-3 transition-colors hover:border-[#10b98145] hover:bg-[#10b98112]"
              >
                <HardHat className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] font-semibold text-slate-300 leading-snug text-center">Operator</span>
                <span className="text-[10px] text-slate-500 text-center">View demo</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
