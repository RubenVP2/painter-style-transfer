import type { Palette } from "../color";
import { DEVICES } from "../devices";
import { CANVAS_PRESETS, type Scene } from "../scene";
import { drawBackground } from "./background";
import {
  bodyRectFor,
  drawDeviceFrame,
  drawDropShadow,
  drawScreenEdge,
  screenRadiusFor,
  screenRectFor,
} from "./device";
import { drawTikTokGuides } from "./guides";
import { drawLockScreen } from "./lockscreen";
import { drawCover, verticalGradient, withRoundRectClip, type Ctx2D, type Rect } from "./primitives";

export type RenderOptions = {
  width: number;
  height: number;
  /** Guides are a preview aid and are never drawn into an export. */
  showGuides?: boolean;
  palette?: Palette | null;
};

function resolveTone(scene: Scene, palette: Palette | null | undefined) {
  if (scene.lockScreen.textTone !== "auto") return scene.lockScreen.textTone;
  return palette && palette.topLuminance > 0.62 ? "dark" : "light";
}

function drawEmptyScreen(ctx: Ctx2D, screen: Rect) {
  ctx.fillStyle = verticalGradient(ctx, screen, [
    [0, "#20222c"],
    [1, "#101118"],
  ]);
  ctx.fillRect(screen.x, screen.y, screen.width, screen.height);
}

/**
 * The single source of truth for what the mockup looks like. The preview canvas
 * and the exporter both call this, so what you see is exactly what you get.
 */
export function renderScene(ctx: Ctx2D, scene: Scene, options: RenderOptions) {
  const { width, height, showGuides = false, palette = null } = options;
  const canvas: Rect = { x: 0, y: 0, width, height };
  const preset = CANVAS_PRESETS[scene.canvas.preset];
  // Sliders are calibrated against the 1080px-wide export, so scale from there.
  const unitPerExportPx = width / preset.width;

  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, scene, canvas, unitPerExportPx);

  const spec = DEVICES[scene.device.model];
  const { rect: body, unit } = bodyRectFor(spec, canvas, scene.device.scale);
  const framed = scene.device.showFrame;
  const screen = framed ? screenRectFor(spec, body, unit) : body;
  const radius = framed ? screenRadiusFor(spec, unit) : spec.bodyRadius * unit;

  // The shadow follows whichever silhouette is actually visible.
  drawDropShadow(
    ctx,
    framed ? body : screen,
    framed ? spec.bodyRadius * unit : radius,
    unit,
    scene.device.shadow,
  );
  if (framed) drawDeviceFrame(ctx, spec, scene.device.finish, body, unit);

  withRoundRectClip(ctx, screen, radius, () => {
    if (scene.wallpaper.bitmap) {
      drawCover(ctx, scene.wallpaper.bitmap, screen, {
        zoom: scene.wallpaper.zoom,
        offsetX: scene.wallpaper.offsetX,
        offsetY: scene.wallpaper.offsetY,
      });
    } else {
      drawEmptyScreen(ctx, screen);
    }

    if (scene.lockScreen.enabled) {
      drawLockScreen(ctx, scene, spec, screen, resolveTone(scene, palette));
    }
  });

  if (framed) drawScreenEdge(ctx, screen, radius, unit);
  if (showGuides && scene.guides.tiktokSafeZones) drawTikTokGuides(ctx, canvas, unitPerExportPx);
}

export { screenRectFor, bodyRectFor };
