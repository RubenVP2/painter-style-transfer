/**
 * Camera math for the live parallax preview, ported 1:1 from the parallax
 * service's `ParallaxScene.update()` (parallax/service.py). Keeping the presets
 * in one place on each side means the preview traces the same trajectory the
 * rendered video will — same intensity scaling, same per-animation curves.
 *
 * The service drives a DepthFlow camera; the browser turns the state below into
 * a depth-displacement in a WebGL shader (see parallax-gl.ts). The projection is
 * an approximation of DepthFlow's ray-marched render, but the *motion* — which
 * is what the parameters tune — is exact.
 */

import type { ParallaxAnimation } from "./parallax";

/** Camera state for one frame, mirroring the DepthScene fields the presets set. */
export type ParallaxCamera = {
  offsetX: number;
  offsetY: number;
  isometric: number;
  steady: number;
  /** Displacement amplitude; the `zoom` preset animates this. */
  height: number;
  focus: number;
  zoom: number;
};

// DepthScene's neutral state, the baseline each preset overrides a subset of.
const BASE: ParallaxCamera = {
  offsetX: 0,
  offsetY: 0,
  isometric: 0,
  steady: 0,
  height: 0.35,
  focus: 1,
  zoom: 1,
};

/**
 * Camera state at a given phase of the loop.
 *
 * `phase` is 0..1 over the whole clip; the service's presets use one full
 * oscillation per clip (`sin(cycle)` with `cycle = 2π·phase`), which is what
 * makes the exported video loop seamlessly — the preview loops the same way.
 */
export function parallaxCameraAt(
  animation: ParallaxAnimation,
  intensity: number,
  phase: number,
): ParallaxCamera {
  const cycle = 2 * Math.PI * phase;
  // Amplitude scale so intensity 0.5 reproduces the official presets, exactly
  // as `_build_scene` documents on the service side.
  const k = 2.0 * intensity;
  const state: ParallaxCamera = { ...BASE };

  switch (animation) {
    case "circle":
      state.isometric = 0.6;
      state.steady = 0.3;
      state.offsetX = k * 0.5 * Math.sin(cycle + Math.PI / 2);
      state.offsetY = k * 0.5 * Math.sin(cycle);
      break;
    case "horizontal":
      state.isometric = 0.6;
      state.steady = 0.3;
      state.offsetX = k * 0.8 * Math.sin(cycle);
      break;
    case "vertical":
      state.isometric = 0.6;
      state.steady = 0.3;
      state.offsetY = k * 0.8 * Math.sin(cycle);
      break;
    case "zoom":
      state.height = 0.8 * Math.sin(cycle / 2) ** 2;
      break;
    case "dolly":
      state.height = 0.3;
      state.steady = 0.35;
      state.focus = 0.35;
      state.zoom = 0.95;
      state.isometric = 0.5 * (1 - Math.cos(cycle));
      break;
    case "orbital":
      state.steady = 0.3;
      state.focus = 0.3;
      state.zoom = 0.98;
      state.isometric = 0.5 * Math.cos(cycle) + 0.75;
      state.offsetX = k * 0.5 * Math.sin(cycle);
      break;
  }

  return state;
}
