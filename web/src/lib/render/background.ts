import type { Scene } from "../scene";
import { drawCover, verticalGradient, type Ctx2D, type Rect } from "./primitives";

/**
 * Blur samples pixels outside the drawn image, which would fade the canvas
 * edges to transparent. Drawing the wallpaper well past the canvas bounds keeps
 * the fade off-screen.
 */
function overscan(canvas: Rect, blurPx: number): Rect {
  const margin = Math.max(canvas.width, canvas.height) * 0.12 + blurPx * 3;
  return {
    x: canvas.x - margin,
    y: canvas.y - margin,
    width: canvas.width + margin * 2,
    height: canvas.height + margin * 2,
  };
}

export function drawBackground(ctx: Ctx2D, scene: Scene, canvas: Rect, unitPerExportPx: number) {
  const { background, wallpaper } = scene;

  // A solid base guarantees an opaque canvas, which JPEG export requires.
  ctx.fillStyle = background.mode === "solid" ? background.solid : "#0b0b10";
  ctx.fillRect(canvas.x, canvas.y, canvas.width, canvas.height);

  if (background.mode === "gradient") {
    ctx.fillStyle = verticalGradient(ctx, canvas, [
      [0, background.gradient[0]],
      [1, background.gradient[1]],
    ]);
    ctx.fillRect(canvas.x, canvas.y, canvas.width, canvas.height);
    return;
  }

  if (background.mode === "solid" || !wallpaper.bitmap) return;

  const blurPx = background.blur * unitPerExportPx;
  ctx.save();
  ctx.filter = `blur(${blurPx.toFixed(2)}px) saturate(${background.saturation}) brightness(${background.brightness})`;
  drawCover(ctx, wallpaper.bitmap, overscan(canvas, blurPx));
  ctx.restore();
}
