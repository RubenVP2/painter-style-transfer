import type { ImageSource } from "./render/primitives";

export type Palette = {
  /** Two dominant colours, darkest last — used as the gradient background default. */
  dominant: [string, string];
  /** 0..1 luminance of the band where the lock screen clock sits. */
  topLuminance: number;
};

const SAMPLE = 48;

const toHex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

/** Rec. 709 relative luminance, on a 0..1 scale. */
function luminance(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function shift(hex: string, amount: number) {
  const value = parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, channel + amount * 255)),
  );
  return rgbToHex(channels[0], channels[1], channels[2]);
}

/**
 * Downsamples the wallpaper once and derives everything the renderer needs from
 * it: a gradient palette and the luminance behind the clock, which decides
 * whether the lock screen text goes white or black.
 */
export function analyseImage(image: ImageSource): Palette | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image as CanvasImageSource, 0, 0, SAMPLE, SAMPLE);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    // Tainted canvas (cross-origin source); fall back to defaults.
    return null;
  }

  // 4 bits per channel keeps the histogram small while still separating hues.
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  let topSum = 0;
  let topCount = 0;

  for (let y = 0; y < SAMPLE; y += 1) {
    for (let x = 0; x < SAMPLE; x += 1) {
      const i = (y * SAMPLE + x) * 4;
      const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
      if (a < 16) continue;

      // Rows 5%..32% sit behind the clock and date.
      if (y >= SAMPLE * 0.05 && y <= SAMPLE * 0.32) {
        topSum += luminance(r, g, b);
        topCount += 1;
      }

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((bucket) => rgbToHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count));

  const primary = ranked[0] ?? "#3b3b6b";
  const secondary = ranked[1] ?? shift(primary, -0.28);

  return {
    dominant: [shift(primary, 0.06), shift(secondary, -0.22)],
    topLuminance: topCount ? topSum / topCount : 0.35,
  };
}
