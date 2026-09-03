import { PARALLAX_INTERNAL_URL } from "@/lib/parallax-server";

// Streams a potentially large mp4/zip back, so keep it on the Node runtime and
// never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Forward the multipart render request to parallax over the internal network
 * and stream its response (video/mp4 or application/zip) straight back.
 *
 * The upload is re-encoded via FormData rather than piped: it keeps this robust
 * across runtimes (no half-duplex streaming caveats) and the payload is a
 * handful of wallpaper PNGs. The heavy side — the rendered video — is streamed.
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
    upstream = await fetch(`${PARALLAX_INTERNAL_URL}/render`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { detail: "Service parallaxe injoignable." },
      { status: 502 },
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  headers.set("cache-control", "no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}
