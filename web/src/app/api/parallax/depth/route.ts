import { PARALLAX_INTERNAL_URL } from "@/lib/parallax-server";

// Proxied server-side over the docker internal network, like the other parallax
// routes: never cached, always on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Forward a single-image depth request to parallax and stream the PNG back.
 *
 * The Studio's live preview calls this once per image; the response is a small
 * grayscale PNG, so — unlike /render — it is buffered rather than streamed,
 * which keeps the runtime handling trivial.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ detail: "Requête multipart invalide." }, { status: 400 });
  }

  let upstream: Response;
  try {
    // No explicit content-type header: fetch sets the multipart boundary itself.
    upstream = await fetch(`${PARALLAX_INTERNAL_URL}/depth`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
  } catch {
    return Response.json({ detail: "Service parallaxe injoignable." }, { status: 502 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", "no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}
