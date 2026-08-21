import type { Palette } from "./color";
import { renderScene } from "./render";
import { CANVAS_PRESETS, type Scene } from "./scene";

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
