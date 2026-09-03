/**
 * Client for the parallax video service: turns one or more wallpapers into an
 * MP4 (single image) or a ZIP of MP4s (batch) by POSTing the raw bitmaps.
 */

import type { ImageSource } from "./render/primitives";

export type ParallaxAnimation = "circle" | "horizontal" | "vertical" | "zoom" | "dolly" | "orbital";

export type ParallaxSettings = {
  animation: ParallaxAnimation;
  /** 0.1–1, how far the virtual camera travels. */
  intensity: number;
  /** Clip length in seconds, 2–20. */
  time: number;
  /** 24 | 30 | 60. */
  fps: 24 | 30 | 60;
  /** Output height in pixels: 720 | 1080 | 1440 | 1920. */
  heightPx: 720 | 1080 | 1440 | 1920;
  /** Supersampling factor: 1 | 1.5 | 2. */
  ssaa: 1 | 1.5 | 2;
  /** Swaps the near/far planes, which flips the perceived motion direction. */
  invertDepth: boolean;
};

export const DEFAULT_PARALLAX: ParallaxSettings = {
  animation: "circle",
  intensity: 0.4,
  time: 6,
  fps: 30,
  heightPx: 1080,
  ssaa: 1,
  invertDepth: false,
};

export const ANIMATIONS: { id: ParallaxAnimation; label: string }[] = [
  { id: "circle", label: "Cercle" },
  { id: "horizontal", label: "Horizontal" },
  { id: "vertical", label: "Vertical" },
  { id: "zoom", label: "Zoom" },
  { id: "dolly", label: "Dolly" },
  { id: "orbital", label: "Orbital" },
];

// Same-origin: the Studio proxies these to the parallax service server-side
// over the docker internal network (see src/app/api/parallax/*). The browser
// never reaches parallax directly, so there is no cross-origin URL to inline.
export const PARALLAX_URL = "/api/parallax";

export const PARALLAX_HEALTH_INTERVAL_MS = 30_000;

/** Cheap liveness probe, polled by the panel to show the fallback notice. */
export async function checkParallaxHealth(signal?: AbortSignal) {
  try {
    const response = await fetch(`${PARALLAX_URL}/health`, { signal });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Anything the batch can hold (ImageBitmap, or an HTMLImageElement fallback in
 * browsers without createImageBitmap) — redrawn onto a canvas below either way.
 */
export async function sourceToBlob(source: ImageSource): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible dans ce navigateur.");
  ctx.drawImage(source, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("La conversion de l'image a échoué.");
  return blob;
}

/** Strips the extension and sanitises, the way exportFilename does. */
function parallaxBaseName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 48) || "wallpaper"
  );
}

export function parallaxFilename(settings: ParallaxSettings, count: number, extension: string) {
  if (count > 1) return `parallaxes-${settings.animation}-${settings.heightPx}p-${count}.${extension}`;
  return `parallax-${settings.animation}-${settings.heightPx}p.${extension}`;
}

export type ParallaxProgress = { done: number; total: number };

export type ParallaxResult = { blob: Blob; filename: string; count: number };

/**
 * Sends the whole batch to POST /render. One image answers video/mp4, several
 * answer application/zip — the content type decides the download name, but the
 * service is trusted with the size of the response either way.
 *
 * onProgress only marks the upload phase (0→1): the service renders in one
 * request and offers no progress channel for the render itself.
 */
export async function renderParallax(
  bitmaps: ImageSource[],
  names: string[],
  settings: ParallaxSettings,
  options: { onProgress?: (progress: ParallaxProgress) => void; signal?: AbortSignal } = {},
): Promise<ParallaxResult> {
  if (bitmaps.length === 0) throw new Error("Aucune image à animer.");
  if (bitmaps.length !== names.length) throw new Error("Images et noms désynchronisés.");

  const form = new FormData();
  form.set("animation", settings.animation);
  form.set("intensity", String(settings.intensity));
  form.set("time", String(settings.time));
  form.set("fps", String(settings.fps));
  form.set("height_px", String(settings.heightPx));
  form.set("ssaa", String(settings.ssaa));
  form.set("invert_depth", String(settings.invertDepth));

  for (const [index, bitmap] of bitmaps.entries()) {
    options.onProgress?.({ done: index, total: bitmaps.length });
    const blob = await sourceToBlob(bitmap);
    form.append("image", blob, `${parallaxBaseName(names[index])}.png`);
    options.onProgress?.({ done: index + 1, total: bitmaps.length });
  }

  const response = await fetch(`${PARALLAX_URL}/render`, {
    method: "POST",
    body: form,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Le service parallaxe a échoué (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const zip = response.headers.get("content-type")?.includes("application/zip");
  const extension = zip ? "zip" : "mp4";
  return {
    blob,
    filename: parallaxFilename(settings, bitmaps.length, extension),
    count: bitmaps.length,
  };
}
