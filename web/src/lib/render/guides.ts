import { font, type Ctx2D, type Rect } from "./primitives";

/**
 * TikTok overlays its own UI on top of the video. These are the safe-zone
 * margins the repository's prompts target, expressed against a 1080x1920 frame.
 */
export const TIKTOK_SAFE_ZONES = { top: 250, bottom: 700, right: 240, reference: 1080 } as const;

/** Preview-only: never drawn into an export. */
export function drawTikTokGuides(ctx: Ctx2D, canvas: Rect, unitPerExportPx: number) {
  const top = TIKTOK_SAFE_ZONES.top * unitPerExportPx;
  const bottom = TIKTOK_SAFE_ZONES.bottom * unitPerExportPx;
  const right = TIKTOK_SAFE_ZONES.right * unitPerExportPx;

  ctx.save();
  ctx.fillStyle = "rgba(255, 45, 85, 0.16)";
  ctx.fillRect(canvas.x, canvas.y, canvas.width, top);
  ctx.fillRect(canvas.x, canvas.y + canvas.height - bottom, canvas.width, bottom);
  ctx.fillRect(canvas.x + canvas.width - right, canvas.y + top, right, canvas.height - top - bottom);

  ctx.strokeStyle = "rgba(255, 45, 85, 0.85)";
  ctx.lineWidth = Math.max(1, 3 * unitPerExportPx);
  ctx.setLineDash([12 * unitPerExportPx, 10 * unitPerExportPx]);
  // Inset by the stroke width so the left edge is not half-clipped.
  const half = ctx.lineWidth / 2;
  ctx.strokeRect(
    canvas.x + half,
    canvas.y + top + half,
    canvas.width - right - ctx.lineWidth,
    canvas.height - top - bottom - ctx.lineWidth,
  );
  ctx.setLineDash([]);

  const label = "Zone sûre TikTok";
  const size = Math.max(11, 26 * unitPerExportPx);
  ctx.font = font(600, size);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillText(label, canvas.x + canvas.width * 0.03, canvas.y + top + size * 0.6);
  ctx.restore();
}
