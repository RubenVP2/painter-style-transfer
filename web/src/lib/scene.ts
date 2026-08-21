import type { DeviceId, FrameFinishId } from "./devices";

export type CanvasPresetId = "9:16" | "4:5" | "1:1";

export type CanvasPreset = {
  id: CanvasPresetId;
  label: string;
  hint: string;
  width: number;
  height: number;
};

export const CANVAS_PRESETS: Record<CanvasPresetId, CanvasPreset> = {
  "9:16": { id: "9:16", label: "9:16", hint: "TikTok / Reels", width: 1080, height: 1920 },
  "4:5": { id: "4:5", label: "4:5", hint: "Feed Instagram", width: 1080, height: 1350 },
  "1:1": { id: "1:1", label: "1:1", hint: "Carré", width: 1080, height: 1080 },
};

export const CANVAS_PRESET_LIST = Object.values(CANVAS_PRESETS);

export type BackgroundMode = "blur" | "gradient" | "solid";

export type TextTone = "auto" | "light" | "dark";

export type Wallpaper = {
  bitmap: ImageBitmap | HTMLImageElement | null;
  /** Original filename, reused when naming the exported file. */
  name: string | null;
  /** Pan inside the screen, normalised to -1..1. */
  offsetX: number;
  offsetY: number;
  zoom: number;
};

export type Scene = {
  wallpaper: Wallpaper;
  canvas: {
    preset: CanvasPresetId;
  };
  background: {
    mode: BackgroundMode;
    /** Blur radius in export pixels, measured against a 1080px-wide canvas. */
    blur: number;
    brightness: number;
    saturation: number;
    solid: string;
    gradient: [string, string];
    /**
     * While true the gradient follows each image's own dominant colours; picking
     * a colour by hand pins it for the whole batch.
     */
    autoGradient: boolean;
  };
  device: {
    model: DeviceId;
    finish: FrameFinishId;
    /** Body height as a fraction of the canvas height. */
    scale: number;
    showFrame: boolean;
    shadow: number;
  };
  lockScreen: {
    enabled: boolean;
    time: string;
    date: string;
    carrier: string;
    battery: number;
    showStatusBar: boolean;
    showIsland: boolean;
    showBottomButtons: boolean;
    showHomeIndicator: boolean;
    showScrim: boolean;
    textTone: TextTone;
  };
  guides: {
    tiktokSafeZones: boolean;
  };
};

/**
 * 9:41 is Apple's canonical mockup time, and a fixed default keeps the server
 * and client renders identical (a live clock would break hydration).
 */
export const DEFAULT_SCENE: Scene = {
  wallpaper: { bitmap: null, name: null, offsetX: 0, offsetY: 0, zoom: 1 },
  canvas: { preset: "9:16" },
  background: {
    mode: "blur",
    blur: 90,
    brightness: 0.78,
    saturation: 1.45,
    solid: "#12121a",
    gradient: ["#3b3b6b", "#12121a"],
    autoGradient: true,
  },
  device: { model: "iphone-16-pro", finish: "natural", scale: 0.74, showFrame: true, shadow: 0.55 },
  lockScreen: {
    enabled: true,
    time: "9:41",
    date: "Mercredi 4 juin",
    carrier: "",
    battery: 82,
    showStatusBar: true,
    showIsland: true,
    showBottomButtons: true,
    showHomeIndicator: true,
    showScrim: true,
    textTone: "auto",
  },
  guides: { tiktokSafeZones: false },
};

export type ScenePatch = <K extends keyof Scene>(section: K, patch: Partial<Scene[K]>) => void;

export function canvasSize(scene: Scene) {
  return CANVAS_PRESETS[scene.canvas.preset];
}
