import type { ImageSource } from "./render/primitives";

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"];
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(",");
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class ImageLoadError extends Error {}

function looksLikeHeic(file: File) {
  return /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
}

async function decodeWithImgElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    // The bitmap is retained by the element; the object URL is not needed after decode.
    URL.revokeObjectURL(url);
  }
}

/**
 * Decodes a dropped/pasted file into something drawable. `createImageBitmap` is
 * the fast path; the `<img>` fallback covers browsers that reject a format there.
 */
export async function loadImageFile(file: File): Promise<ImageSource> {
  if (looksLikeHeic(file)) {
    throw new ImageLoadError(
      "Les fichiers HEIC/HEIF ne sont pas décodables par les navigateurs. Convertis l'image en JPG ou PNG.",
    );
  }
  if (!file.type.startsWith("image/")) {
    throw new ImageLoadError("Ce fichier n'est pas une image.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageLoadError("Image trop lourde (25 Mo maximum).");
  }

  try {
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(file);
    }
  } catch {
    // Fall through to the <img> path.
  }

  try {
    return await decodeWithImgElement(file);
  } catch {
    throw new ImageLoadError("Impossible de décoder cette image.");
  }
}

/** Picks the first usable image out of a drop or paste payload. */
export function firstImageFile(items: FileList | File[] | null | undefined) {
  if (!items) return null;
  for (const file of Array.from(items)) {
    if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|avif|gif|heic|heif)$/i.test(file.name)) {
      return file;
    }
  }
  return null;
}
