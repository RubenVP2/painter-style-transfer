import type { DeviceSpec } from "../devices";
import type { Scene } from "../scene";
import { fillRoundRect, font, verticalGradient, type Ctx2D, type Rect } from "./primitives";

type Tone = "light" | "dark";

type Layout = {
  ctx: Ctx2D;
  screen: Rect;
  /** Pixels per iOS point. */
  u: number;
  /** Logical screen size in points. */
  w: number;
  h: number;
  tone: Tone;
  ink: string;
};

const px = (l: Layout, ptValue: number) => ptValue * l.u;
const X = (l: Layout, ptValue: number) => l.screen.x + ptValue * l.u;
const Y = (l: Layout, ptValue: number) => l.screen.y + ptValue * l.u;

function drawScrim(l: Layout) {
  const { ctx, screen } = l;
  const topHeight = px(l, 210);
  const bottomHeight = px(l, 300);
  const shade = l.tone === "light" ? "0, 0, 0" : "255, 255, 255";

  const topRect = { x: screen.x, y: screen.y, width: screen.width, height: topHeight };
  ctx.fillStyle = verticalGradient(ctx, topRect, [
    [0, `rgba(${shade}, 0.32)`],
    [1, `rgba(${shade}, 0)`],
  ]);
  ctx.fillRect(topRect.x, topRect.y, topRect.width, topRect.height);

  const bottomRect = {
    x: screen.x,
    y: screen.y + screen.height - bottomHeight,
    width: screen.width,
    height: bottomHeight,
  };
  ctx.fillStyle = verticalGradient(ctx, bottomRect, [
    [0, `rgba(${shade}, 0)`],
    [1, `rgba(${shade}, 0.42)`],
  ]);
  ctx.fillRect(bottomRect.x, bottomRect.y, bottomRect.width, bottomRect.height);
}

function drawBattery(l: Layout, right: number, centerY: number, level: number) {
  const { ctx } = l;
  const width = px(l, 25);
  const height = px(l, 12.4);
  const x = right - width;
  const y = centerY - height / 2;

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = l.ink;
  ctx.lineWidth = px(l, 1);
  const outline = { x, y, width, height };
  fillRoundRect(ctx, outline, px(l, 3.6), "transparent");
  ctx.stroke();

  // Terminal nub.
  fillRoundRect(
    ctx,
    { x: x + width + px(l, 1.4), y: centerY - px(l, 2.2), width: px(l, 1.6), height: px(l, 4.4) },
    px(l, 0.8),
    l.ink,
  );
  ctx.restore();

  const pad = px(l, 1.9);
  const innerWidth = (width - pad * 2) * Math.max(0, Math.min(1, level / 100));
  if (innerWidth > 0) {
    fillRoundRect(
      ctx,
      { x: x + pad, y: y + pad, width: innerWidth, height: height - pad * 2 },
      px(l, 2),
      l.ink,
    );
  }

  return width + px(l, 3.4);
}

function drawWifi(l: Layout, right: number, centerY: number) {
  const { ctx } = l;
  const width = px(l, 17);
  const cx = right - width / 2;
  const cy = centerY + px(l, 4.4);

  ctx.save();
  ctx.strokeStyle = l.ink;
  ctx.lineWidth = px(l, 1.9);
  ctx.lineCap = "round";
  for (const radius of [px(l, 3.6), px(l, 6.8)]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI * 1.28, Math.PI * 1.72);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, px(l, 9.6), Math.PI * 1.3, Math.PI * 1.7);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.fillStyle = l.ink;
  ctx.arc(cx, cy - px(l, 0.4), px(l, 1.2), 0, Math.PI * 2);
  ctx.fill();

  return width + px(l, 5);
}

function drawCellular(l: Layout, right: number, centerY: number) {
  const { ctx } = l;
  const barWidth = px(l, 3.1);
  const gap = px(l, 1.9);
  const heights = [px(l, 4.2), px(l, 6.6), px(l, 9), px(l, 11.4)];
  const width = barWidth * 4 + gap * 3;
  const baseline = centerY + px(l, 5.7);

  heights.forEach((height, index) => {
    const x = right - width + index * (barWidth + gap);
    ctx.globalAlpha = index === 3 ? 0.4 : 1;
    fillRoundRect(ctx, { x, y: baseline - height, width: barWidth, height }, px(l, 1), l.ink);
  });
  ctx.globalAlpha = 1;

  return width + px(l, 5);
}

function drawStatusBar(l: Layout, scene: Scene) {
  const centerY = Y(l, 23);
  let right = X(l, l.w - 26);

  right -= drawBattery(l, right, centerY, scene.lockScreen.battery);
  right -= drawWifi(l, right, centerY);
  drawCellular(l, right, centerY);

  const carrier = scene.lockScreen.carrier.trim();
  if (carrier) {
    l.ctx.font = font(600, px(l, 13));
    l.ctx.textAlign = "left";
    l.ctx.textBaseline = "middle";
    l.ctx.fillStyle = l.ink;
    l.ctx.fillText(carrier, X(l, 30), centerY);
  }
}

function drawIsland(l: Layout, spec: DeviceSpec) {
  const width = px(l, spec.island.width);
  const height = px(l, spec.island.height);
  fillRoundRect(
    l.ctx,
    { x: l.screen.x + (l.screen.width - width) / 2, y: Y(l, spec.island.top), width, height },
    height / 2,
    "#000000",
  );
}

function drawClock(l: Layout, scene: Scene) {
  const { ctx } = l;
  const centerX = l.screen.x + l.screen.width / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = l.ink;
  ctx.shadowColor = l.tone === "light" ? "rgba(0, 0, 0, 0.28)" : "rgba(255, 255, 255, 0.22)";
  ctx.shadowBlur = px(l, 10);

  ctx.textBaseline = "alphabetic";
  ctx.font = font(600, px(l, 21));
  ctx.fillText(scene.lockScreen.date, centerX, Y(l, 132));

  ctx.font = font(600, px(l, 94));
  ctx.fillText(scene.lockScreen.time, centerX, Y(l, 236));
  ctx.restore();
}

function drawFlashlightGlyph(l: Layout, cx: number, cy: number) {
  const { ctx } = l;
  const s = l.u;

  // Filling *and* stroking the same path with a round line join is the cheapest
  // way to get the softly rounded corners of the iOS glyph.
  ctx.strokeStyle = l.ink;
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.6 * s;

  // Flared head.
  ctx.beginPath();
  ctx.moveTo(cx - 6.6 * s, cy - 12 * s);
  ctx.lineTo(cx + 6.6 * s, cy - 12 * s);
  ctx.lineTo(cx + 5.2 * s, cy - 8 * s);
  ctx.lineTo(cx - 5.2 * s, cy - 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tapered barrel.
  ctx.beginPath();
  ctx.moveTo(cx - 4.4 * s, cy - 5.2 * s);
  ctx.lineTo(cx + 4.4 * s, cy - 5.2 * s);
  ctx.lineTo(cx + 3.2 * s, cy + 11 * s);
  ctx.lineTo(cx - 3.2 * s, cy + 11 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawCameraGlyph(l: Layout, cx: number, cy: number) {
  const { ctx } = l;
  const s = l.u;
  ctx.beginPath();
  ctx.roundRect(cx - 11 * s, cy - 7 * s, 22 * s, 15 * s, 4.4 * s);
  ctx.roundRect(cx - 5 * s, cy - 10.4 * s, 9 * s, 4 * s, 1.6 * s);
  // Reverse-wound circle punches the lens out under the even-odd rule.
  ctx.moveTo(cx + 4.8 * s, cy + 0.6 * s);
  ctx.arc(cx, cy + 0.6 * s, 4.8 * s, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
}

function drawBottomButtons(l: Layout) {
  const { ctx } = l;
  const diameter = px(l, 52);
  const cy = Y(l, l.h - 84);
  const glassFill = l.tone === "light" ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.14)";

  for (const [cx, glyph] of [
    [X(l, 62), drawFlashlightGlyph],
    [X(l, l.w - 62), drawCameraGlyph],
  ] as const) {
    ctx.beginPath();
    ctx.fillStyle = glassFill;
    ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = l.ink;
    glyph(l, cx, cy);
    ctx.restore();
  }
}

function drawHomeIndicator(l: Layout) {
  const width = px(l, 140);
  fillRoundRect(
    l.ctx,
    {
      x: l.screen.x + (l.screen.width - width) / 2,
      y: Y(l, l.h - 21),
      width,
      height: px(l, 5),
    },
    px(l, 2.5),
    l.ink,
  );
}

/**
 * Paints the iOS lock screen furniture on top of the wallpaper. Callers clip to
 * the screen rounded rect first.
 */
export function drawLockScreen(
  ctx: Ctx2D,
  scene: Scene,
  spec: DeviceSpec,
  screen: Rect,
  tone: Tone,
) {
  const layout: Layout = {
    ctx,
    screen,
    u: screen.height / spec.screen.height,
    w: spec.screen.width,
    h: spec.screen.height,
    tone,
    ink: tone === "light" ? "#ffffff" : "#101014",
  };

  if (scene.lockScreen.showScrim) drawScrim(layout);
  if (scene.lockScreen.showStatusBar) drawStatusBar(layout, scene);
  drawClock(layout, scene);
  if (scene.lockScreen.showBottomButtons) drawBottomButtons(layout);
  if (scene.lockScreen.showHomeIndicator) drawHomeIndicator(layout);
  if (scene.lockScreen.showIsland) drawIsland(layout, spec);
}
