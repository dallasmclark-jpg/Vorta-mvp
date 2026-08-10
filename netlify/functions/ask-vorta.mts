import type { Config, Context } from "@netlify/functions";
import coreHandler, {
  ASK_VORTA_DOCUMENT_LINK_REVISION,
} from "./ask-vorta/runtime-document-links.mjs";
import {
  withAskVortaProgressSink,
  type AskVortaProgressEvent,
} from "./ask-vorta/progress-events.mjs";
import {
  ASK_VORTA_RESPONSE_VALIDATION_REVISION,
} from "./ask-vorta/response-validation.mjs";

// Production release marker: exact approved manual and drawing deep links retain Ask Vorta return context.
// Compatibility marker: runtime-document-links delegates to:
// import handler from "./ask-vorta/runtime-equipment-fallback.mjs";
if (
  ASK_VORTA_RESPONSE_VALIDATION_REVISION !==
    "vor-056-final-backlog-boundary-v1" ||
  ASK_VORTA_DOCUMENT_LINK_REVISION !==
    "vor-067-production-chat-return-v3"
) {
  throw new Error("Ask Vorta validated bundle revision mismatch.");
}

const NDJSON_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

function wantsProgressStream(req: Request): boolean {
  return (req.headers.get("accept") ?? "")
    .toLowerCase()
    .includes("application/x-ndjson");
}

function encodeLine(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

async function responsePayload(response: Response): Promise<unknown> {
  const clone = response.clone();
  return clone.json().catch(async () => ({
    error: (await response.text().catch(() => "")) || "Ask Vorta returned an unreadable response.",
  }));
}

async function streamingHandler(req: Request, context: Context): Promise<Response> {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const pushProgress = (event: AskVortaProgressEvent): void => {
        controller.enqueue(encodeLine({ type: "progress", event }));
      };

      void withAskVortaProgressSink(pushProgress, async () => {
        const response = await coreHandler(req, context);
        const payload = await responsePayload(response);
        controller.enqueue(
          encodeLine({
            type: "result",
            ok: response.ok,
            status: response.status,
            payload,
          }),
        );
      })
        .catch((error) => {
          controller.enqueue(
            encodeLine({
              type: "result",
              ok: false,
              status: 500,
              payload: {
                error:
                  error instanceof Error
                    ? error.message
                    : "Ask Vorta could not complete the analysis.",
              },
            }),
          );
        })
        .finally(() => controller.close());
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": NDJSON_CONTENT_TYPE,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default async function handler(
  req: Request,
  context: Context,
): Promise<Response> {
  return wantsProgressStream(req)
    ? streamingHandler(req, context)
    : coreHandler(req, context);
}

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};