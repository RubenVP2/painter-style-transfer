import { PARALLAX_INTERNAL_URL } from "@/lib/parallax-server";

// Proxied server-side over the docker internal network, so never cached and
// always run on the Node runtime (undici fetch, no edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Forward the liveness probe to parallax; a dead service becomes 503. */
export async function GET() {
  try {
    const upstream = await fetch(`${PARALLAX_INTERNAL_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ status: "down" }, { status: 503 });
  }
}
