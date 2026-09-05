import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  normalisePilotRole,
  roleHomePath,
} from "../../lib/auth";
import { VortaLoadingScreen } from "../../components/VortaLoadingScreen";

export function AuthCallbackPage(): JSX.Element {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function completeOAuth(): Promise<void> {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;
        if (sessionError || !session) {
          throw sessionError ?? new Error("Vorta could not complete authentication.");
        }

        const metadata = session.user.user_metadata ?? {};
        const invitationId =
          typeof metadata.vorta_invitation_id === "string"
            ? metadata.vorta_invitation_id
            : null;

        if (invitationId) {
          const { data: accepted, error: invitationError } = await supabase.rpc(
            "vorta_accept_site_invitation",
            {
              p_invitation_id: invitationId,
              p_full_name:
                typeof metadata.full_name === "string"
                  ? metadata.full_name
                  : null,
            },
          );

          if (invitationError) throw invitationError;

          const acceptedRole = normalisePilotRole(accepted?.[0]?.app_role);
          window.location.replace(
            acceptedRole ? roleHomePath(acceptedRole) : "/",
          );
          return;
        }

        if (metadata.vorta_signup_intent === "site_owner") {
          const required = [
            metadata.full_name,
            metadata.vorta_organisation_name,
            metadata.vorta_industry,
            metadata.vorta_country,
            metadata.vorta_site_name,
          ];

          if (required.some((value) => typeof value !== "string" || !value.trim())) {
            throw new Error("The Vorta site setup details are incomplete. Return to sign up and try again.");
          }

          const { data: created, error: bootstrapError } = await supabase.rpc(
            "vorta_bootstrap_site_owner",
            {
              p_full_name: metadata.full_name,
              p_organisation_name: metadata.vorta_organisation_name,
              p_industry: metadata.vorta_industry,
              p_country: metadata.vorta_country,
              p_site_name: metadata.vorta_site_name,
              p_site_location:
                typeof metadata.vorta_site_location === "string"
                  ? metadata.vorta_site_location
                  : null,
            },
          );

          if (bootstrapError) throw bootstrapError;

          const createdRole = normalisePilotRole(created?.[0]?.app_role);
          window.location.replace(
            createdRole ? roleHomePath(createdRole) : "/dashboard",
          );
          return;
        }

        const [profileResult, accessResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle(),
          supabase
            .from("user_site_access")
            .select("app_role,is_default")
            .eq("user_id", session.user.id)
            .eq("active", true)
            .order("is_default", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (profileResult.error || accessResult.error) {
          throw new Error("Vorta could not verify your portal access.");
        }

        const role =
          normalisePilotRole(accessResult.data?.app_role) ??
          normalisePilotRole(profileResult.data?.role);

        if (!role) {
          await supabase.auth.signOut();
          if (active) {
            navigate("/", {
              replace: true,
              state: {
                authError:
                  "Your account does not have an active Vorta site role.",
              },
            });
          }
          return;
        }

        window.location.replace(roleHomePath(role));
      } catch (callbackError) {
        if (!active) return;
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : "Vorta could not complete authentication.",
        );
      }
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
