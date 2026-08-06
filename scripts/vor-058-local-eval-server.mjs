import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const host = process.env.VORTA_LOCAL_HOST || "127.0.0.1";
const port = Number(process.env.VORTA_LOCAL_PORT || 8788);
const outputDirectory = ".vor-058-local";
const outputFile = `${outputDirectory}/ask-vorta-handler.mjs`;

await mkdir(outputDirectory, { recursive: true });

globalThis.Netlify = {
  env: {
    get(name) {
      return process.env[name];
    },
  },
};

await build({
  entryPoints: ["netlify/functions/ask-vorta.mts"],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: false,
  logLevel: "warning",
});

const moduleUrl = `${pathToFileURL(outputFile).href}?build=${Date.now()}`;
const { default: handler } = await import(moduleUrl);

if (typeof handler !== "function") {
  throw new Error("The bundled Ask Vorta function did not export a handler.");
}

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const requestUrl = new URL(incoming.url || "/", `http://${host}:${port}`);
    const request = new Request(requestUrl, {
      method: incoming.method,
      headers: incoming.headers,
      body:
        incoming.method === "GET" || incoming.method === "HEAD"
          ? undefined
          : body,
    });
    const response = await handler(request, {
      requestId: randomUUID(),
    });

    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("Local Ask Vorta handler failed", error);
    outgoing.statusCode = 500;
    outgoing.setHeader("content-type", "application/json");
    outgoing.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Local handler failed.",
      }),
    );
  }
});

server.listen(port, host, () => {
  console.log(`VOR-058 exact-source server listening at http://${host}:${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
