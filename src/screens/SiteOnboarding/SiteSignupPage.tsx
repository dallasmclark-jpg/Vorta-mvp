import { useState } from "react";
import { Link } from "react-router-dom";
import { VortaLogo } from "../../components/VortaLogo";
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

const fieldClass = "h-11 w-full border border-slate-700 px-3 text-sm text-slate-200";
const darkField = { backgroundColor: "#0b0e14" };

export function SiteSignupPage(): JSX.Element {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const update = (field: keyof SignupForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const canSubmit = Boolean(
    form.fullName.trim() && form.email.trim() && form.password.length >= 8 &&
    form.organisationName.trim() && form.industry && form.country.trim() && form.siteName.trim(),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const metadata = {
        full_name: form.fullName.trim(),
        vorta_signup_intent: "site_owner",
        vorta_organisation_name: form.organisationName.trim(),
        vorta_industry: form.industry,
        vorta_country: form.country.trim(),
        vorta_site_name: form.siteName.trim(),
        vorta_site_location: form.siteLocation.trim() || null,
      };
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?setup=site`,
          data: metadata,
        },
      });
      if (signUpError) throw signUpError;
      if (!data.session) {
        setVerificationSent(true);
        return;
      }
      const { error: bootstrapError } = await supabase.rpc("vorta_bootstrap_site_owner", {
        p_full_name: metadata.full_name,
        p_organisation_name: metadata.vorta_organisation_name,
        p_industry: metadata.vorta_industry,
        p_country: metadata.vorta_country,
        p_site_name: metadata.vorta_site_name,
        p_site_location: metadata.vorta_site_location,
      });
      if (bootstrapError) throw bootstrapError;
      window.location.assign("/dashboard");
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Could not create the site account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (verificationSent) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 text-slate-100" style={darkField}>
        <section className="w-full border border-slate-800 p-6 text-center" style={{ backgroundColor: "#11151d", maxWidth: 512 }}>
          <VortaLogo />
          <h1 className="mt-6 text-2xl font-semibold text-white">Verify your work email</h1>
          <p className="mt-3 text-sm text-slate-400">Use the verification link sent to {form.email.trim()}.</p>
          <Link to="/" className="mt-6 inline-flex h-11 items-center border border-slate-700 px-4 text-sm text-slate-200">Return to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 text-slate-100" style={darkField}>
      <section className="mx-auto w-full border border-slate-800 p-6" style={{ backgroundColor: "#11151d", maxWidth: 672 }}>
        <Link to="/" aria-label="Vorta home"><VortaLogo /></Link>
        <h1 className="mt-6 text-2xl font-semibold text-white">Set up your Vorta account</h1>
        <p className="mt-2 text-sm text-slate-400">Create your company site. The first verified account becomes Site Owner.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <label>Full name<input className={fieldClass} style={darkField} value={form.fullName} onChange={(e) => update("fullName", e.target.value)} autoComplete="name" /></label>
          <label>Work email<input className={fieldClass} style={darkField} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" /></label>
          <label>Password<input className={fieldClass} style={darkField} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="new-password" placeholder="Minimum 8 characters" /></label>
          <label>Company name<input className={fieldClass} style={darkField} value={form.organisationName} onChange={(e) => update("organisationName", e.target.value)} /></label>
          <label>Industry<select className={fieldClass} style={darkField} value={form.industry} onChange={(e) => update("industry", e.target.value)}><option value="">Select industry</option>{INDUSTRIES.map((industry) => <option key={industry}>{industry}</option>)}</select></label>
          <label>Country<input className={fieldClass} style={darkField} value={form.country} onChange={(e) => update("country", e.target.value)} /></label>
          <label>Site name<input className={fieldClass} style={darkField} value={form.siteName} onChange={(e) => update("siteName", e.target.value)} /></label>
          <label>Location<input className={fieldClass} style={darkField} value={form.siteLocation} onChange={(e) => update("siteLocation", e.target.value)} /></label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={!canSubmit || submitting} className="h-11 bg-blue-600 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Creating…" : "Create Vorta site"}</button>
        </form>
      </section>
    </main>
  );
}
