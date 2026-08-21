export type Rect = { x: number; y: number; width: number; height: number };

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * macOS and iOS ship SF Pro, which is what the real lock screen uses; Inter is
 * the closest widely available stand-in everywhere else.
 */
export const FONT_STACK =
  '-apple-system, "SF Pro Display", "SF Pro Text", Inter, system-ui, "Segoe UI", Roboto, sans-serif';

export function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT_STACK}`;
}

export function roundRectPath(ctx: Ctx2D, rect: Rect, radius: number) {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, r);
  ctx.arcTo(rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height, r);
  ctx.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y, r);
  ctx.arcTo(rect.x, rect.y, rect.x + rect.width, rect.y, r);
  ctx.closePath();
}

export function fillRoundRect(ctx: Ctx2D, rect: Rect, radius: number, fill: string | CanvasGradient) {
  roundRectPath(ctx, rect, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Runs `draw` clipped to a rounded rectangle. */
export function withRoundRectClip(ctx: Ctx2D, rect: Rect, radius: number, draw: () => void) {
  ctx.save();
  roundRectPath(ctx, rect, radius);
  ctx.clip();
  draw();
  ctx.restore();
}

export function inset(rect: Rect, amount: number): Rect {
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    width: rect.width - amount * 2,
    height: rect.height - amount * 2,
  };
}

export type ImageSource = ImageBitmap | HTMLImageElement;

function sourceSize(image: ImageSource) {
  return image instanceof HTMLImageElement
    ? { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }
    : { width: image.width, height: image.height };
}

/**
 * Draws `image` so it covers `rect` entirely (object-fit: cover), with an extra
 * `zoom` factor and a pan expressed as -1..1 of the available overflow.
 */
export function drawCover(
  ctx: Ctx2D,
  image: ImageSource,
  rect: Rect,
  { zoom = 1, offsetX = 0, offsetY = 0 } = {},
) {
  const { width: sw, height: sh } = sourceSize(image);
  if (!sw || !sh) return;

  const scale = Math.max(rect.width / sw, rect.height / sh) * zoom;
  const dw = sw * scale;
  const dh = sh * scale;
  const slackX = Math.max(0, (dw - rect.width) / 2);
  const slackY = Math.max(0, (dh - rect.height) / 2);
  const dx = rect.x + (rect.width - dw) / 2 + offsetX * slackX;
  const dy = rect.y + (rect.height - dh) / 2 + offsetY * slackY;

  ctx.drawImage(image as CanvasImageSource, dx, dy, dw, dh);
}

export function verticalGradient(ctx: Ctx2D, rect: Rect, stops: [number, string][]) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}

export function horizontalGradient(ctx: Ctx2D, rect: Rect, stops: [number, string][]) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}
