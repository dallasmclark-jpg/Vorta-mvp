import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { VortaLogo, VortaIcon } from "../../components/VortaLogo";

export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut();

    navigate("/", {
      replace: true,
      state: {
        successMessage:
          "Your password has been updated. You can now sign in.",
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e14]">
      <header className="flex h-16 items-center border-b border-gray-800 bg-[#090b10] px-6 md:px-10">
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Return to Vorta login"
        >
          <VortaLogo />
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-[400px] flex-col items-center">
          <VortaIcon className="mb-6 h-10 w-[72px]" />

          <h1 className="text-center text-[28px] font-semibold text-white">
            Set a new password
          </h1>

          <p className="mb-8 mt-2 text-center text-sm text-slate-400">
            Enter and confirm your new Vorta password.
          </p>

          <form
            onSubmit={handleSubmit}
            className="w-full space-y-5"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-slate-300"
              >
                New password
              </label>

              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3.5 pr-11 text-sm text-slate-200 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-slate-300"
              >
                Confirm password
              </label>

              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                className="h-11 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3.5 text-sm text-slate-200 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-[#ef444408] px-3.5 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-70"
            >
              {submitting ? "Updating password…" : "Update password"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
