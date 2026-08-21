/**
 * Device geometry, expressed in iOS points. Every renderer converts points to
 * pixels with a single factor (`unit`), so the same numbers drive the on-screen
 * preview and the 1080x1920 export.
 */

export type DeviceId = "iphone-16-pro" | "iphone-16";

export type FrameFinishId = "natural" | "black" | "white" | "desert";

export type SideButton = {
  side: "left" | "right";
  /** Distance from the top of the body, in points. */
  top: number;
  height: number;
};

export type DeviceSpec = {
  id: DeviceId;
  label: string;
  /** Logical screen size in points. */
  screen: { width: number; height: number };
  /** Black border between the metal edge and the screen. */
  bezel: number;
  /** Visible metal band around the bezel. */
  band: number;
  bodyRadius: number;
  screenRadius: number;
  island: { width: number; height: number; top: number };
  buttons: SideButton[];
};

export const DEVICES: Record<DeviceId, DeviceSpec> = {
  "iphone-16-pro": {
    id: "iphone-16-pro",
    label: "iPhone 16 Pro",
    screen: { width: 402, height: 874 },
    bezel: 4.2,
    band: 1.8,
    bodyRadius: 62,
    screenRadius: 55,
    island: { width: 125, height: 37, top: 11 },
    buttons: [
      { side: "left", top: 168, height: 28 }, // Action button
      { side: "left", top: 216, height: 54 }, // Volume up
      { side: "left", top: 282, height: 54 }, // Volume down
      { side: "right", top: 196, height: 62 }, // Side button
      { side: "right", top: 286, height: 28 }, // Camera Control
    ],
  },
  "iphone-16": {
    id: "iphone-16",
    label: "iPhone 16",
    screen: { width: 393, height: 852 },
    bezel: 5.4,
    band: 2.2,
    bodyRadius: 58,
    screenRadius: 50,
    island: { width: 125, height: 37, top: 11 },
    buttons: [
      { side: "left", top: 160, height: 28 },
      { side: "left", top: 208, height: 52 },
      { side: "left", top: 272, height: 52 },
      { side: "right", top: 190, height: 78 },
    ],
  },
};

export const DEVICE_LIST = Object.values(DEVICES);

/** Outer body size in points, screen plus bezel plus metal band. */
export function bodySize(spec: DeviceSpec) {
  const inset = 2 * (spec.bezel + spec.band);
  return { width: spec.screen.width + inset, height: spec.screen.height + inset };
}

export type FrameFinish = {
  id: FrameFinishId;
  label: string;
  /** Sampled left-to-right across the metal band. */
  stops: [string, string, string, string];
  /** Colour of the protruding side buttons. */
  button: string;
};

export const FRAME_FINISHES: Record<FrameFinishId, FrameFinish> = {
  natural: {
    id: "natural",
    label: "Titane naturel",
    stops: ["#8d8880", "#e6e2db", "#b4afa6", "#78736c"],
    button: "#9a958d",
  },
  black: {
    id: "black",
    label: "Titane noir",
    stops: ["#1b1b1e", "#585a60", "#303237", "#131316"],
    button: "#3a3c41",
  },
  white: {
    id: "white",
    label: "Titane blanc",
    stops: ["#c9c6c1", "#ffffff", "#e2ded8", "#aeaaa4"],
    button: "#d5d1cb",
  },
  desert: {
    id: "desert",
    label: "Titane désert",
    stops: ["#9c8a70", "#efe0c8", "#c8b295", "#8d7a63"],
    button: "#bda589",
  },
};

export const FRAME_FINISH_LIST = Object.values(FRAME_FINISHES);
