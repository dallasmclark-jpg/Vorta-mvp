import { useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Factory, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { VortaIcon, VortaLogo } from "../../components/VortaLogo";
import { supabase } from "../../lib/supabaseClient";

type SignupForm = {
  fullName: string;
  email: string;
  password: string;
  organisationName: string;
  industry: string;
  country: string;
  siteName: string;
  siteLocation: string;
};

const INDUSTRIES = [
  "Pharmaceutical",
  "Food & Beverage",
  "Chemical",
  "Aerospace",
  "Nuclear",
  "Oil & Gas",
  "Automotive",
  "Consumer Goods",
  "Other Manufacturing",
];

const initialForm: SignupForm = {
  fullName: "",
  email: "",
  password: "",
  organisationName: "",
  industry: "",
  country: "United Kingdom",
  siteName: "",
  siteLocation: "",
};

export function SiteSignupPage(): JSX.Element {
  const [form, setForm] = useState<SignupForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.fullName.trim() &&
          form.email.trim() &&
          form.password.length >= 8 &&
          form.organisationName.trim() &&
          form.industry &&
          form.country.trim() &&
          form.siteName.trim(),
      ),
    [form],
  );

  const update = (field: keyof SignupForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const completeBootstrap = async (): Promise<void> => {
    const { error: bootstrapError } = await supabase.rpc(
      "vorta_bootstrap_site_owner",
      {
        p_full_name: form.fullName.trim(),
        p_organisation_name: form.organisationName.trim(),
        p_industry: form.industry,
        p_country: form.country.trim(),
        p_site_name: form.siteName.trim(),
        p_site_location: form.siteLocation.trim() || null,
      },
    );

    if (bootstrapError) throw bootstrapError;
    window.location.assign("/dashboard");
  };

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?setup=site`,
          data: {
            full_name: form.fullName.trim(),
            vorta_signup_intent: "site_owner",
            vorta_organisation_name: form.organisationName.trim(),
            vorta_industry: form.industry,
            vorta_country: form.country.trim(),
            vorta_site_name: form.siteName.trim(),
            vorta_site_location: form.siteLocation.trim() || null,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        await completeBootstrap();
        return;
      }

      setVerificationSent(true);
    } catch (signupError) {
      setError(
        signupError instanceof Error
          ? signupError.message
          : "Vorta could not create the site account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (verificationSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0e14] px-4 py-12 text-slate-100">
        <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#11151d] p-7 shadow-2xl shadow-black/30 sm:p-9">
          <div className="flex justify-center"><VortaIcon className="h-10 w-[72px]" /></div>
          <div className="mx-auto mt-7 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="mt-5 text-center text-2xl font-semibold text-white">Verify your work email</h1>
          <p className="mt-3 text-center text-sm leading-6 text-slate-400">
            We sent a secure verification link to <span className="font-medium text-slate-200">{form.email.trim()}</span>.
            Open it to create the organisation, site and your Site Owner access.
          </p>
          <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3 text-xs leading-5 text-blue-200/85">
            No Vorta employee needs to create the site or administrator. The verified first account owns the site setup.
          </div>
          <Link to="/" className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 text-sm font-semibold text-slate-200 hover:bg-white/[0.04]">
            <ArrowLeft className="h-4 w-4" /> Return to sign in
          </Link>
        </section>
      </main>
    );
  }

  const fieldClass = "h-11 w-full rounded-lg border border-slate-700 bg-[#0b0e14] px-3.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30";
  const labelClass = "mb-1.5 block text-sm font-medium text-slate-300";

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100">
      <header className="flex h-16 items-center border-b border-slate-800 px-6 md:px-10">
        <Link to="/" aria-label="Vorta home"><VortaLogo /></Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-16">
        <section className="hidden lg:block lg:pt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/[0.06] px-3 py-1.5 text-xs font-semibold text-blue-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Self-service site activation
          </div>
          <h1 className="mt-5 max-w-md text-4xl font-semibold leading-tight text-white">Create your Vorta site without waiting for Vorta.</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            The first verified account becomes the Site Owner and can invite administrators, engineers, planners and the wider site team.
          </p>
          <div className="mt-8 space-y-4 text-sm text-slate-300">
            <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-blue-400" /> Organisation and tenant created automatically</div>
            <div className="flex items-center gap-3"><Factory className="h-5 w-5 text-blue-400" /> Site scoped from the first login</div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-blue-400" /> Customer-managed users, roles and ownership</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#11151d] p-5 shadow-2xl shadow-black/25 sm:p-7 lg:p-8">
          <div className="mb-7">
            <VortaIcon className="h-9 w-[64px] lg:hidden" />
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-400 lg:mt-0">Create site</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Set up your Vorta account</h2>
            <p className="mt-2 text-sm text-slate-400">Your work email must be verified before the site is created.</p>
          </div>

          <form onSubmit={submit} className="space-y-7">
            <div>
              <h3 className="mb-4 text-sm font-semibold text-slate-200">Your account</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Full name</span><input className={fieldClass} value={form.fullName} onChange={(e) => update("fullName", e.target.value)} autoComplete="name" placeholder="Sarah Jones" /></label>
                <label><span className={labelClass}>Work email</span><input className={fieldClass} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" placeholder="sarah@company.com" /></label>
                <label className="sm:col-span-2"><span className={labelClass}>Password</span><input className={fieldClass} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="new-password" placeholder="Minimum 8 characters" /></label>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <h3 className="mb-4 text-sm font-semibold text-slate-200">Organisation</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className={labelClass}>Company name</span><input className={fieldClass} value={form.organisationName} onChange={(e) => update("organisationName", e.target.value)} placeholder="Company name" /></label>
                <label><span className={labelClass}>Industry</span><select className={fieldClass} value={form.industry} onChange={(e) => update("industry", e.target.value)}><option value="">Select industry</option>{INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label><span className={labelClass}>Country</span><input className={fieldClass} value={form.country} onChange={(e) => update("country", e.target.value)} /></label>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <h3 className="mb-4 text-sm font-semibold text-slate-200">Site</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Site name</span><input className={fieldClass} value={form.siteName} onChange={(e) => update("siteName", e.target.value)} placeholder="Liverpool Manufacturing" /></label>
                <label><span className={labelClass}>Location</span><input className={fieldClass} value={form.siteLocation} onChange={(e) => update("siteLocation", e.target.value)} placeholder="Liverpool" /></label>
              </div>
            </div>

            {error && <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">{error}</div>}

            <button type="submit" disabled={!canSubmit || submitting} className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Creating secure account…" : "Create Vorta site"}
            </button>

            <p className="text-center text-xs leading-5 text-slate-500">
              By continuing you create the first Site Admin account with Site Owner authority for this site. Ownership can later be transferred to another active Site Admin.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
