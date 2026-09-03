/**
 * Client for the depth side of the parallax service: turns one wallpaper into a
 * grayscale depthmap the live preview displaces in WebGL. This is the cheap half
 * of a render — the depth estimate only — so it can run on every image the user
 * lands on without the ffmpeg wait.
 */

import { PARALLAX_URL, sourceToBlob } from "./parallax";
import type { ImageSource } from "./render/primitives";

/**
 * One depth estimate per source, cached for the life of the bitmap. Only the
 * camera parameters change while the user tunes; the depthmap does not, so it is
 * fetched once and reused across every preview frame and every reopen.
 *
 * A WeakMap keys on the decoded bitmap itself, so the entry is collected when
 * the wallpaper leaves the batch — no manual eviction, no id plumbing.
 */
const cache = new WeakMap<ImageSource, Promise<ImageBitmap>>();

async function requestDepth(source: ImageSource): Promise<ImageBitmap> {
  const form = new FormData();
  form.append("image", await sourceToBlob(source), "wallpaper.png");

  const response = await fetch(`${PARALLAX_URL}/depth`, { method: "POST", body: form });
  if (!response.ok) {
    throw new Error(`Le service parallaxe a échoué (HTTP ${response.status}).`);
  }
  return createImageBitmap(await response.blob());
}

/**
 * The depthmap for a wallpaper, memoised. A failed estimate is not cached, so a
 * transient service outage can be retried simply by asking again.
 */
export function getDepthMap(source: ImageSource): Promise<ImageBitmap> {
  const cached = cache.get(source);
  if (cached) return cached;

  const pending = requestDepth(source).catch((error) => {
    cache.delete(source);
    throw error;
  });
  cache.set(source, pending);
  return pending;
}
