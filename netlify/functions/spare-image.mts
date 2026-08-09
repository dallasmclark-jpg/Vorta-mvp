import type { Config } from "@netlify/functions";

const ALLOWED_HOSTS = new Set(["mall.industry.siemens.com"]);

export default async (request: Request): Promise<Response> => {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get("url");

  if (!source) {
    return new Response("Missing image URL", { status: 400 });
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(source);
  } catch {
    return new Response("Invalid image URL", { status: 400 });
  }

  if (upstreamUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(upstreamUrl.hostname)) {
    return new Response("Image host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: "https://mall.industry.siemens.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      },
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
      return new Response("Upstream image unavailable", { status: 502 });
    }

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Upstream image unavailable", { status: 502 });
  }
};

export const config: Config = {
  path: "/api/spare-image",
  method: "GET",
};
