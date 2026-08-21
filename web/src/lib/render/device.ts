import { bodySize, FRAME_FINISHES, type DeviceSpec, type FrameFinishId } from "../devices";
import {
  fillRoundRect,
  horizontalGradient,
  inset,
  roundRectPath,
  type Ctx2D,
  type Rect,
} from "./primitives";

/** The live screen area inside a body rectangle. */
export function screenRectFor(spec: DeviceSpec, body: Rect, unit: number) {
  return inset(body, (spec.band + spec.bezel) * unit);
}

export function screenRadiusFor(spec: DeviceSpec, unit: number) {
  return spec.screenRadius * unit;
}

/** Fits the device body inside the canvas without ever letting it overflow. */
export function bodyRectFor(spec: DeviceSpec, canvas: Rect, scale: number) {
  const size = bodySize(spec);
  const ratio = size.width / size.height;

  let height = canvas.height * scale;
  let width = height * ratio;
  const maxWidth = canvas.width * 0.94;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }

  return {
    rect: {
      x: canvas.x + (canvas.width - width) / 2,
      y: canvas.y + (canvas.height - height) / 2,
      width,
      height,
    },
    unit: height / size.height,
  };
}

function drawSideButtons(ctx: Ctx2D, spec: DeviceSpec, body: Rect, unit: number, color: string) {
  const protrusion = 2.4 * unit;
  const overlap = 8 * unit;

  ctx.fillStyle = color;
  for (const button of spec.buttons) {
    const height = button.height * unit;
    const y = body.y + button.top * unit;
    const rect =
      button.side === "left"
        ? { x: body.x - protrusion, y, width: protrusion + overlap, height }
        : { x: body.x + body.width - overlap, y, width: protrusion + overlap, height };
    fillRoundRect(ctx, rect, protrusion, color);
  }
}

/** Painted on its own pass so the frame gradients stay clean. */
export function drawDropShadow(
  ctx: Ctx2D,
  rect: Rect,
  radius: number,
  unit: number,
  shadow: number,
) {
  if (shadow <= 0) return;
  ctx.save();
  ctx.shadowColor = `rgba(0, 0, 0, ${0.55 * shadow})`;
  ctx.shadowBlur = 70 * unit * shadow;
  ctx.shadowOffsetY = 26 * unit * shadow;
  fillRoundRect(ctx, rect, radius, "#000000");
  ctx.restore();
}

export function drawDeviceFrame(
  ctx: Ctx2D,
  spec: DeviceSpec,
  finishId: FrameFinishId,
  body: Rect,
  unit: number,
) {
  const finish = FRAME_FINISHES[finishId];
  const bodyRadius = spec.bodyRadius * unit;

  drawSideButtons(ctx, spec, body, unit, finish.button);

  // Metal band.
  const band = horizontalGradient(ctx, body, [
    [0, finish.stops[0]],
    [0.14, finish.stops[1]],
    [0.55, finish.stops[2]],
    [1, finish.stops[3]],
  ]);
  fillRoundRect(ctx, body, bodyRadius, band);

  // Machined highlight along the top edge.
  ctx.save();
  roundRectPath(ctx, body, bodyRadius);
  ctx.clip();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = Math.max(0.5, 0.9 * unit);
  roundRectPath(ctx, inset(body, 0.45 * unit), bodyRadius);
  ctx.stroke();
  ctx.restore();

  // Black bezel between the band and the glass.
  const bezelRect = inset(body, spec.band * unit);
  fillRoundRect(ctx, bezelRect, bodyRadius - spec.band * unit, "#08080a");
}

/** Thin inner shadow that sells the glass sitting below the bezel. */
export function drawScreenEdge(ctx: Ctx2D, screen: Rect, radius: number, unit: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = Math.max(0.5, 1.2 * unit);
  roundRectPath(ctx, inset(screen, ctx.lineWidth / 2), radius);
  ctx.stroke();
  ctx.restore();
}
