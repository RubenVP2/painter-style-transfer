"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Palette } from "@/lib/color";
import { imageFiles } from "@/lib/image";
import { renderScene } from "@/lib/render";
import { CANVAS_PRESETS, type Scene, type ScenePatch } from "@/lib/scene";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function Stage({
  scene,
  patch,
  palette,
  onFiles,
  children,
}: {
  scene: Scene;
  patch: ScenePatch;
  palette: Palette | null;
  onFiles: (files: File[]) => void;
  children?: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [fontsReady, setFontsReady] = useState(false);
  const [dragging, setDragging] = useState(false);

  const preset = CANVAS_PRESETS[scene.canvas.preset];
  const aspect = preset.width / preset.height;

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

  // The canvas clock is drawn with a webfont; redraw once it has actually loaded.
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || displayWidth <= 0 || displayHeight <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.round(displayWidth * dpr);
    const height = Math.round(displayHeight * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    renderScene(ctx, scene, { width, height, showGuides: true, palette });
  }, [scene, palette, displayWidth, displayHeight, fontsReady]);

  // Wheel zoom needs a non-passive listener to be able to preventDefault.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!scene.wallpaper.bitmap) return;
      event.preventDefault();
      patch("wallpaper", {
        zoom: clamp(scene.wallpaper.zoom * (1 - event.deltaY * 0.0015), 1, 4),
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [patch, scene.wallpaper.bitmap, scene.wallpaper.zoom]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = imageFiles(
        Array.from(event.clipboardData?.files ?? []).length
          ? event.clipboardData!.files
          : (Array.from(event.clipboardData?.items ?? [])
              .map((item) => item.getAsFile())
              .filter(Boolean) as File[]),
      );
      if (files.length > 0) {
        event.preventDefault();
        onFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles]);

  const pan = useRef<{ id: number; x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!scene.wallpaper.bitmap) return;
      pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [scene.wallpaper.bitmap],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const active = pan.current;
      if (!active || active.id !== event.pointerId || displayWidth <= 0) return;

      // One screen width of travel sweeps the full -1..1 pan range.
      patch("wallpaper", {
        offsetX: clamp(scene.wallpaper.offsetX + ((event.clientX - active.x) / displayWidth) * 2, -1, 1),
        offsetY: clamp(scene.wallpaper.offsetY + ((event.clientY - active.y) / displayHeight) * 2, -1, 1),
      });
      pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    [patch, scene.wallpaper.offsetX, scene.wallpaper.offsetY, displayWidth, displayHeight],
  );

  const endPan = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pan.current?.id === event.pointerId) {
      pan.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  }, []);

  return (
    <div
      ref={wrapperRef}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        // The drop hands over everything; the studio decides what it can keep.
        onFiles(Array.from(event.dataTransfer.files));
      }}
      className="relative flex h-full w-full items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        data-testid="mockup-canvas"
        aria-label="Aperçu du mockup"
        style={{ width: displayWidth || 1, height: displayHeight || 1 }}
        className={`rounded-xl shadow-2xl shadow-black/60 ${
          scene.wallpaper.bitmap ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={() => patch("wallpaper", { offsetX: 0, offsetY: 0, zoom: 1 })}
      />

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-dashed border-accent bg-accent/10" />
      ) : null}

      {children}
    </div>
  );
}
