import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  resolveSessionRole,
  roleHomePath,
} from "../../lib/auth";
import { VortaLoadingScreen } from "../../components/VortaLoadingScreen";

export function AuthCallbackPage(): JSX.Element {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function completeOAuth(): Promise<void> {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (sessionError || !session) {
        setError(
          sessionError?.message ??
            "Vorta could not complete authentication.",
        );
        return;
      }

      const role = resolveSessionRole(session);

      if (!role) {
        await supabase.auth.signOut();

        if (active) {
          navigate("/", {
            replace: true,
            state: {
              authError:
                "Your account does not have a supported Vorta pilot role.",
            },
          });
        }

        return;
      }

      navigate(roleHomePath(role), { replace: true });
    }

    void completeOAuth();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0e14] px-4">
        <div className="w-full max-w-md rounded-xl border border-red-500/20 bg-[#11151d] p-6 text-center">
          <h1 className="text-lg font-semibold text-white">
            Sign-in could not be completed
          </h1>
          <p className="mt-2 text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="mt-6 h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  return <VortaLoadingScreen />;
}
