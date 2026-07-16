const ALLOWED_FUNCTIONS = new Set([
  "skills-matrix-data",
  "engineers-data",
  "requirements-data",
  "training-data",
  "training-providers-data",
  "ai-matching-data",
]);

function jsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

function configuredSupabaseUrl(): string {
  const configured =
    Netlify.env.get("VITE_SUPABASE_URL")?.trim() ?? "";

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  // The project URL is public configuration, not a secret. Keep this fallback
  // so the edge proxy still works when VITE variables are build-scoped only.
  return "https://ndhqxetvkaeyiwvnvjjy.supabase.co";
}

export default async function maintenanceDataProxy(
  request: Request,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405,
    );
  }

  const requestUrl = new URL(request.url);
  const functionName =
    requestUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";

  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    return jsonResponse(
      { error: "Unknown maintenance data resource" },
      404,
    );
  }

  const authorization = request.headers.get("authorization");
  const apiKey = request.headers.get("apikey");

  if (!authorization || !apiKey) {
    return jsonResponse(
      { error: "Authentication required" },
      401,
    );
  }

  const requestBody = await request.text();
  const startedAt = performance.now();

  try {
    const upstream = await fetch(
      `${configuredSupabaseUrl()}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          apikey: apiKey,
          "Content-Type": "application/json",
          "X-Client-Info": "vorta-netlify-edge/1.0",
        },
        body: requestBody || "{}",
      },
    );

    const responseHeaders = new Headers({
      "Content-Type":
        upstream.headers.get("content-type") ??
        "application/json",
      "Cache-Control": "private, no-store",
      "Server-Timing": `supabase;dur=${Math.round(
        performance.now() - startedAt,
      )}`,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Maintenance data proxy failed", {
      functionName,
      message:
        error instanceof Error
          ? error.message
          : "Unknown upstream error",
    });

    return jsonResponse(
      { error: "Maintenance data could not be loaded" },
      502,
    );
  }
}

export const config = {
  path: "/api/maintenance-data/*",
};
