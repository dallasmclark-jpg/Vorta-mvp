import { useState } from "react";
import { Eye, EyeOff, LayoutDashboard, User } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
// ─── Google logo SVG (matches screenshot) ────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Top navigation bar ───────────────────────────────────────────────────────

function TopNav() {
  return (
    <header className="flex h-16 w-full items-center border-b border-[#ffffff0d] px-6 md:px-10">
      <a href="/" aria-label="Vorta home" className="flex items-center gap-2 select-none shrink-0">
        <span className="font-mono text-base font-bold text-white leading-none">&gt;&lt;</span>
        <span className="text-sm font-bold tracking-[0.15em] text-white uppercase">Vorta</span>
        <span className="hidden text-[10px] font-medium tracking-widest text-slate-500 uppercase lg:block">Network</span>
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

  // If already authenticated, redirect to intended destination or dashboard
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";
  if (!loading && session) return <Navigate to={from} replace />;

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
    navigate(from, { replace: true });
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <TopNav />

      {/* ── Centered content ──────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-[400px] flex-col items-center">

          {/* "><" icon mark */}
          <div className="mb-6 select-none font-mono text-3xl font-bold text-white leading-none">
            &gt;&lt;
          </div>

          {/* Heading */}
          <h1 className="mb-2 text-center text-[28px] font-semibold leading-tight text-white">
            Log in to your account
          </h1>
          <p className="mb-8 text-center text-sm text-slate-400">
            Welcome back! Please enter your details.
          </p>

          {/* Sign up / Log in toggle */}
          <div className="mb-6 flex w-full rounded-lg bg-[#111518] p-1">
            <button
              type="button"
              className="flex-1 rounded-md py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Sign up
            </button>
            <button
              type="button"
              className="flex-1 rounded-md bg-[#1c2338] py-2 text-sm font-semibold text-white"
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
                className="h-11 w-full rounded-lg border border-[#ffffff18] bg-[#0d0d0d] px-3.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
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
                  className="h-11 w-full rounded-lg border border-[#ffffff18] bg-[#0d0d0d] px-3.5 pr-11 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
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
                  className="h-4 w-4 cursor-pointer rounded border-[#ffffff25] bg-[#0d0d0d] accent-blue-600"
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

            {/* Google SSO */}
            <button
              type="button"
              onClick={handleGoogle}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#ffffff18] bg-transparent text-sm font-semibold text-slate-300 transition-colors hover:bg-[#ffffff06] hover:text-white"
            >
              <GoogleIcon />
              Sign in with Google
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
          <div className="mt-8 w-full border-t border-[#ffffff0d] pt-6">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-slate-600">
              MVP Demo Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-[#3b82f625] bg-[#3b82f608] px-3 py-3 text-left transition-colors hover:border-[#3b82f645] hover:bg-[#3b82f612]"
              >
                <LayoutDashboard className="h-4 w-4 text-blue-400" />
                <span className="text-[11px] font-semibold text-slate-300 leading-snug text-center">Maintenance Manager</span>
                <span className="text-[10px] text-slate-600 text-center">View demo</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/engineer-dashboard")}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-[#10b98125] bg-[#10b98108] px-3 py-3 text-left transition-colors hover:border-[#10b98145] hover:bg-[#10b98112]"
              >
                <User className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] font-semibold text-slate-300 leading-snug text-center">Engineer</span>
                <span className="text-[10px] text-slate-600 text-center">View demo</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
