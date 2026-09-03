"use client";

import { useEffect, useRef, useState } from "react";
import { parallaxCameraAt } from "@/lib/parallax-camera";
import { getDepthMap } from "@/lib/parallax-depth";
import { ParallaxRenderer } from "@/lib/parallax-gl";
import type { ParallaxSettings } from "@/lib/parallax";
import type { ImageSource } from "@/lib/render/primitives";

function aspectOf(source: ImageSource) {
  const width = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  return width && height ? width / height : 9 / 16;
}

/**
 * The live parallax preview: animates the depth-displaced wallpaper in real time
 * against the current settings, so the user tunes the effect without waiting on
 * a render. The depthmap is fetched once (the slow-ish half), then every frame
 * is a cheap camera update — changing any control is instant.
 *
 * It stands in for the static mockup while open; the actual video is still only
 * produced by "Générer la vidéo".
 */
export function ParallaxPreview({
  source,
  name,
  settings,
  onClose,
}: {
  source: ImageSource;
  name: string | null;
  settings: ParallaxSettings;
  onClose: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ParallaxRenderer | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);

  // The loop reads the freshest settings/play state without re-subscribing.
  const settingsRef = useRef(settings);
  const playingRef = useRef(playing);
  useEffect(() => {
    settingsRef.current = settings;
    playingRef.current = playing;
  });

  const aspect = aspectOf(source);
  let displayWidth = box.width;
  let displayHeight = displayWidth / aspect;
  if (displayHeight > box.height) {
    displayHeight = box.height;
    displayWidth = displayHeight * aspect;
  }

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Close on Escape, like a dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Build the renderer and load the image + its depthmap. The component is
  // keyed by wallpaper (see Studio), so this runs once per image from the
  // default "loading" state — no synchronous reset here. Every setState lives in
  // an async continuation so a first render is never blocked on the estimate.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let renderer: ParallaxRenderer | null = null;

    void (async () => {
      try {
        renderer = new ParallaxRenderer(canvas);
        renderer.setImage(source);
        const depth = await getDepthMap(source);
        if (disposed) return;
        renderer.setDepth(depth);
        rendererRef.current = renderer;
        setStatus("ready");
      } catch (cause) {
        if (disposed) return;
        setError(cause instanceof Error ? cause.message : "Aperçu indisponible.");
        setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      rendererRef.current = null;
      renderer?.dispose();
    };
  }, [source]);

  // The animation clock: advance the loop phase by real elapsed time so the
  // preview runs at the same speed the clip will, and loops seamlessly.
  useEffect(() => {
    if (status !== "ready") return;
    let raf = 0;
    let last = performance.now();
    let phase = 0;

    const frame = (now: number) => {
      const renderer = rendererRef.current;
      const dt = (now - last) / 1000;
      last = now;
      const current = settingsRef.current;
      if (playingRef.current && current.time > 0) {
        phase = (phase + dt / current.time) % 1;
      }
      if (renderer) {
        renderer.resize(displayWidth, displayHeight);
        renderer.render(
          parallaxCameraAt(current.animation, current.intensity, phase),
          current.invertDepth,
        );
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [status, displayWidth, displayHeight]);

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col bg-ink-900/95 backdrop-blur"
      data-testid="parallax-preview"
      role="dialog"
      aria-label="Aperçu live de la parallaxe"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="min-w-0 truncate text-sm text-white/80">
          <span className="text-white/50">Aperçu live · </span>
          {name ?? "wallpaper"}
        </p>
        <button
          type="button"
          className="btn-ghost shrink-0"
          onClick={onClose}
          data-testid="parallax-preview-close"
        >
          Fermer l&apos;aperçu
        </button>
      </div>

      <div ref={wrapperRef} className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2">
        <canvas
          ref={canvasRef}
          data-testid="parallax-preview-canvas"
          style={{ width: displayWidth || 1, height: displayHeight || 1 }}
          className={`rounded-xl shadow-2xl shadow-black/60 ${status === "ready" ? "" : "opacity-0"}`}
          onClick={() => setPlaying((value) => !value)}
        />

        {status === "loading" ? (
          <p className="absolute text-sm text-ink-300" data-testid="parallax-preview-loading">
            Estimation de la profondeur…
          </p>
        ) : null}
        {status === "error" ? (
          <p className="absolute max-w-sm text-center text-sm text-red-300" data-testid="parallax-preview-error">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setPlaying((value) => !value)}
          disabled={status !== "ready"}
          data-testid="parallax-preview-playpause"
        >
          {playing ? "Pause" : "Lecture"}
        </button>
        <p className="text-right text-xs text-ink-500">
          Approximation temps réel · ajuste les réglages, puis « Générer la vidéo »
        </p>
      </div>
    </div>
  );
}
