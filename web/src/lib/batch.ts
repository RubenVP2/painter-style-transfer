import { analyseImage, type Palette } from "./color";
import { ImageLoadError, loadImageFile } from "./image";
import type { ImageSource } from "./render/primitives";
import type { Scene } from "./scene";

/**
 * Every image is decoded and kept in memory for the whole session, so the batch
 * has to stay bounded: 24 wallpapers of 25 MB decode to a few hundred MB of
 * bitmaps, which a tab handles; an unbounded drop of a photo library does not.
 */
export const MAX_BATCH_ITEMS = 24;

export type WallpaperItem = {
  id: string;
  /** Original filename, reused when naming the exported file. */
  name: string;
  bytes: number;
  bitmap: ImageSource;
  palette: Palette | null;
  /** Crop is per image: it depends on where the subject sits in that one file. */
  offsetX: number;
  offsetY: number;
  zoom: number;
};

export type RejectedFile = { name: string; reason: string };

export type IngestResult = { accepted: WallpaperItem[]; rejected: RejectedFile[] };

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `w${Date.now()}${Math.random().toString(16).slice(2)}`;

/**
 * Decodes a drop, one file at a time, and accounts for every single one: a file
 * either comes back in `accepted` or is named in `rejected` with the reason.
 * A file that fails to decode never aborts the rest of the batch.
 *
 * Decoding is sequential on purpose — 24 parallel `createImageBitmap` calls on
 * large images spike memory for no wall-clock gain.
 */
export async function ingestFiles(
  files: File[],
  existing: WallpaperItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<IngestResult> {
  const accepted: WallpaperItem[] = [];
  const rejected: RejectedFile[] = [];
  const seen = new Set(existing.map((item) => `${item.name}:${item.bytes}`));
  let done = 0;

  for (const file of files) {
    const key = `${file.name}:${file.size}`;

    if (existing.length + accepted.length >= MAX_BATCH_ITEMS) {
      rejected.push({ name: file.name, reason: `${MAX_BATCH_ITEMS} images maximum par lot` });
    } else if (seen.has(key)) {
      rejected.push({ name: file.name, reason: "déjà dans le lot" });
    } else {
      try {
        const bitmap = await loadImageFile(file);
        seen.add(key);
        accepted.push({
          id: newId(),
          name: file.name,
          bytes: file.size,
          bitmap,
          palette: analyseImage(bitmap),
          offsetX: 0,
          offsetY: 0,
          zoom: 1,
        });
      } catch (cause) {
        rejected.push({
          name: file.name,
          reason: cause instanceof ImageLoadError ? cause.message : "image illisible",
        });
      }
    }

    done += 1;
    onProgress?.(done, files.length);
  }

  return { accepted, rejected };
}

/**
 * Projects the shared settings onto one image. This is what makes the batch
 * work without touching the renderer: `renderScene` still receives a plain
 * `Scene` with a single wallpaper, whether it draws the preview or an export.
 */
export function sceneForItem(scene: Scene, item: WallpaperItem | null): Scene {
  if (!item) return scene;
  return {
    ...scene,
    wallpaper: {
      bitmap: item.bitmap,
      name: item.name,
      offsetX: item.offsetX,
      offsetY: item.offsetY,
      zoom: item.zoom,
    },
    background:
      scene.background.autoGradient && item.palette
        ? { ...scene.background, gradient: item.palette.dominant }
        : scene.background,
  };
}

/** Frees a decoded bitmap as soon as its item leaves the batch. */
export function releaseItem(item: WallpaperItem) {
  if (typeof ImageBitmap !== "undefined" && item.bitmap instanceof ImageBitmap) item.bitmap.close();
}
