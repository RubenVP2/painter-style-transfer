import { sceneForItem, type WallpaperItem } from "./batch";
import type { Palette } from "./color";
import { renderScene } from "./render";
import { CANVAS_PRESETS, type Scene } from "./scene";
import { createZip, type Bytes } from "./zip";

export type ExportFormat = "jpeg" | "png";

export type ExportSettings = {
  format: ExportFormat;
  /** 1 = the preset's native size, 2 = double resolution. */
  multiplier: 1 | 2;
  quality: number;
};

export const DEFAULT_EXPORT: ExportSettings = { format: "jpeg", multiplier: 1, quality: 0.92 };

export function exportDimensions(scene: Scene, multiplier: number) {
  const preset = CANVAS_PRESETS[scene.canvas.preset];
  return { width: preset.width * multiplier, height: preset.height * multiplier };
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("La génération de l'image a échoué."))),
      type,
      quality,
    );
  });
}

/**
 * Re-renders the scene at full export resolution. Guides are explicitly off, so
 * the safe-zone overlay never leaks into a deliverable.
 */
export async function renderExportBlob(
  scene: Scene,
  settings: ExportSettings,
  palette: Palette | null,
) {
  const { width, height } = exportDimensions(scene, settings.multiplier);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: settings.format === "png" });
  if (!ctx) throw new Error("Canvas 2D indisponible dans ce navigateur.");

  ctx.imageSmoothingQuality = "high";
  renderScene(ctx, scene, { width, height, showGuides: false, palette });

  const mime = settings.format === "png" ? "image/png" : "image/jpeg";
  const blob = await toBlob(canvas, mime, settings.quality);
  return { blob, width, height };
}

export function exportFilename(scene: Scene, settings: ExportSettings, width: number, height: number) {
  const base = (scene.wallpaper.name ?? "wallpaper")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
  const extension = settings.format === "png" ? "png" : "jpg";
  return `${base || "wallpaper"}-mockup-${width}x${height}.${extension}`;
}

/**
 * Disambiguates names inside an archive: two source files can share a basename
 * (`export.png` from two folders), and a ZIP with duplicate entries is a trap —
 * most extractors silently keep one of them.
 */
export function uniqueFilenames(names: string[]) {
  const used = new Set<string>();
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dot = name.lastIndexOf(".");
    const [base, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let counter = 2;
    let candidate = `${base}-${counter}${extension}`;
    while (used.has(candidate)) {
      counter += 1;
      candidate = `${base}-${counter}${extension}`;
    }
    used.add(candidate);
    return candidate;
  });
}

export type BatchProgress = { done: number; total: number };

/**
 * Renders every wallpaper of the batch with the shared settings and packs the
 * results into one archive.
 *
 * Images are rendered one at a time: a 2160×3840 canvas plus its blob is tens
 * of megabytes, and holding 24 of those at once is what would actually break a
 * tab. `signal` lets the UI abandon a long batch between two images.
 */
export async function renderBatchArchive(
  items: WallpaperItem[],
  scene: Scene,
  settings: ExportSettings,
  options: { onProgress?: (progress: BatchProgress) => void; signal?: AbortSignal } = {},
) {
  const { width, height } = exportDimensions(scene, settings.multiplier);
  const names = uniqueFilenames(
    items.map((item) => exportFilename(sceneForItem(scene, item), settings, width, height)),
  );
  const entries: { name: string; data: Bytes }[] = [];

  for (const [index, item] of items.entries()) {
    if (options.signal?.aborted) throw new DOMException("Export annulé.", "AbortError");
    const composed = sceneForItem(scene, item);
    const { blob } = await renderExportBlob(composed, settings, item.palette);
    entries.push({ name: names[index], data: new Uint8Array(await blob.arrayBuffer()) });
    options.onProgress?.({ done: index + 1, total: items.length });
  }

  return { blob: createZip(entries), width, height, count: entries.length };
}

export function batchArchiveName(count: number, width: number, height: number) {
  return `mockups-${width}x${height}-${count}.zip`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Browsers only accept image/png on the async clipboard, so a copy is always
 * rendered as PNG regardless of the chosen export format.
 */
export async function copySceneToClipboard(scene: Scene, palette: Palette | null) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Le presse-papiers image n'est pas supporté par ce navigateur.");
  }
  const { blob } = await renderExportBlob(scene, { format: "png", multiplier: 1, quality: 1 }, palette);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
