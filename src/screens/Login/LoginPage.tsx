import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

// ─── Microsoft logo SVG ───────────────────────────────────────────────────────

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

// ─── Vorta wordmark ───────────────────────────────────────────────────────────

function VortaWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <span className="font-mono text-lg font-bold leading-none text-white tracking-tighter">&gt;&lt;</span>
      <span className="text-sm font-bold tracking-[0.18em] text-white uppercase">Vorta</span>
      <span className="text-[10px] font-medium tracking-wider text-slate-500 uppercase hidden xl:block">Network</span>
    </div>
  );
}

// ─── Dashboard preview (right panel) ─────────────────────────────────────────

function DashboardPreview() {
  const kpis = [
    { label: "Engineers",     value: "24",   sub: "Active staff",        color: "text-slate-50" },
    { label: "Critical Gaps", value: "11",   sub: "Require action",      color: "text-red-400"  },
    { label: "Site Coverage", value: "61%",  sub: "Skill requirements",  color: "text-yellow-400" },
    { label: "Training",      value: "38",   sub: "Active bookings",     color: "text-blue-400" },
  ];

  const navItems = [
    { label: "Dashboard",    active: true  },
    { label: "Engineers",    active: false },
    { label: "Skills Matrix",active: false },
    { label: "Requirements", active: false },
    { label: "Training",     active: false },
    { label: "Providers",    active: false },
  ];

  const tableRows = [
    { name: "J. Williams",   discipline: "Electrical",  score: 82, risk: "low",    riskColor: "text-emerald-400" },
    { name: "M. Patel",      discipline: "Automation",  score: 71, risk: "medium", riskColor: "text-yellow-400" },
    { name: "S. Thompson",   discipline: "Mechanical",  score: 58, risk: "high",   riskColor: "text-orange-400" },
    { name: "R. Okonkwo",    discipline: "Electrical",  score: 44, risk: "high",   riskColor: "text-red-400"    },
    { name: "C. Beaumont",   discipline: "Reliability", score: 91, risk: "low",    riskColor: "text-emerald-400"},
  ];

  return (
    <div className="flex h-full overflow-hidden rounded-[18px] border border-[#ffffff12] bg-[#090b10]">
      {/* Sidebar */}
      <div className="flex w-[52px] flex-col items-center gap-4 border-r border-[#ffffff0d] bg-[#060810] py-4">
        <div className="mb-2 flex items-center justify-center">
          <span className="font-mono text-[11px] font-bold text-white">&gt;&lt;</span>
        </div>
        {navItems.map((item) => (
          <div
            key={item.label}
            title={item.label}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              item.active ? "bg-[#3b82f61a] text-blue-500" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <div className={`h-3.5 w-3.5 rounded-sm ${item.active ? "bg-blue-500" : "bg-current"}`} />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex h-10 items-center justify-between border-b border-[#ffffff0d] px-4">
          <div>
            <span className="text-[10px] font-medium text-slate-500">Alpha Manufacturing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-[52px] rounded bg-[#ffffff08]" />
            <div className="h-6 w-6 rounded-full bg-[#3b82f620]" />
          </div>
        </div>

        {/* Page header */}
        <div className="border-b border-[#ffffff0d] px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-200">Dashboard</p>
          <p className="text-[9px] text-slate-500">Workforce readiness overview</p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-4 gap-2 p-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-[#ffffff0d] bg-[#141820] p-2.5">
              <p className="text-[8px] font-medium text-slate-500 truncate">{k.label}</p>
              <p className={`mt-1 text-sm font-bold tabular-nums ${k.color}`}>{k.value}</p>
              <p className="mt-0.5 text-[8px] text-slate-600 truncate">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Mini table */}
        <div className="mx-3 mb-3 overflow-hidden rounded-lg border border-[#ffffff0d]">
          <div className="border-b border-[#ffffff0d] bg-[#0f1318] px-3 py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Engineers</p>
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-[#ffffff08]">
                {["Name", "Discipline", "Score", "Risk"].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={r.name} className={`border-b border-[#ffffff06] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                  <td className="px-3 py-1.5 font-medium text-slate-300">{r.name}</td>
                  <td className="px-3 py-1.5 text-slate-500">{r.discipline}</td>
                  <td className="px-3 py-1.5 font-semibold text-slate-200">{r.score}%</td>
                  <td className={`px-3 py-1.5 font-medium capitalize ${r.riskColor}`}>{r.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI badge */}
        <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-[#3b82f618] bg-[#3b82f608] px-3 py-2">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="text-[9px] font-medium text-blue-400">AI analysis active · 11 critical gaps identified</span>
        </div>
      </div>
    </div>
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────

export const LoginPage = (): JSX.Element => {
  const navigate = useNavigate();

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember,     setRemember]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Redirect already-authenticated users straight to the dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // TODO: Implement role-based routing once user profiles (e.g. profiles.role) are available.
    // For now all authenticated users are directed to the main dashboard.
    navigate("/", { replace: true });
  };

  const handleMicrosoft = async () => {
    // TODO: Enable Azure AD provider in Supabase Auth settings and configure the Azure app registration.
    await supabase.auth.signInWithOAuth({ provider: "azure", options: { redirectTo: window.location.origin } });
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-black">
      {/* ── Left: login form ──────────────────────────────────────────────── */}
      <section className="flex w-full flex-col bg-black lg:w-[480px] lg:shrink-0 xl:w-[520px]">
        <div className="flex flex-1 flex-col px-8 py-10 sm:px-12 lg:px-14">
          <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col">

            {/* Logo */}
            <div className="pt-2">
              <VortaWordmark />
            </div>

            {/* Form area — vertically centred */}
            <div className="flex flex-1 items-center">
              <div className="w-full">
                <header className="mb-8">
                  <h1 className="text-2xl font-semibold tracking-tight text-white">Log in</h1>
                  <p className="mt-2 text-sm text-slate-400">Welcome back! Please enter your details.</p>
                </header>

                <form onSubmit={handleSignIn} noValidate className="space-y-5">

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

                  {/* Error message */}
                  {error && (
                    <div className="rounded-lg border border-red-500/20 bg-[#ef444408] px-3.5 py-2.5 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  {/* Sign in button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative h-11 w-full overflow-hidden rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-70"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Signing in…
                      </span>
                    ) : "Sign in"}
                  </button>

                  {/* Microsoft SSO */}
                  <button
                    type="button"
                    onClick={handleMicrosoft}
                    className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#ffffff18] bg-[#0d0d0d] text-sm font-semibold text-slate-300 shadow-sm transition-colors hover:bg-[#141414] hover:text-white"
                  >
                    <MicrosoftIcon />
                    Sign in with Microsoft
                  </button>
                </form>

                {/* Request access */}
                <p className="mt-6 flex items-baseline justify-center gap-1 text-center text-sm">
                  <span className="text-slate-500">Need access?</span>
                  <button type="button" className="font-semibold text-slate-300 transition-colors hover:text-white">
                    Contact your admin
                  </button>
                </p>
              </div>
            </div>

            {/* Footer */}
            <footer className="pt-8">
              <p className="text-sm text-slate-600">© Vorta {new Date().getFullYear()}</p>
            </footer>
          </div>
        </div>
      </section>

      {/* ── Right: dashboard preview ──────────────────────────────────────── */}
      <aside className="relative hidden flex-1 items-center justify-center overflow-hidden bg-[#0a0a0a] lg:flex">
        {/* Subtle radial glow behind the preview */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 60% 50%, rgba(59,130,246,0.04) 0%, transparent 70%)" }}
        />

        <div className="relative w-full max-w-[640px] px-8 xl:px-12">
          {/* Outer device ring */}
          <div className="rounded-[22px] border border-[#ffffff10] bg-[#0b0e14] p-[3px] shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
            {/* Inner ring */}
            <div className="overflow-hidden rounded-[19px] border border-[#ffffff08]">
              {/* Fixed-height container — the preview renders inside */}
              <div className="h-[480px]">
                <DashboardPreview />
              </div>
            </div>
          </div>

          {/* Caption */}
          <p className="mt-5 text-center text-xs font-medium text-slate-600 tracking-wider uppercase">
            Vorta Maintenance Manager · Alpha Manufacturing
          </p>
        </div>
      </aside>
    </div>
  );
};
