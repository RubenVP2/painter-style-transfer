"use client";

import { useEffect, useRef } from "react";
import { MAX_BATCH_ITEMS, type WallpaperItem } from "@/lib/batch";
import { drawCover } from "@/lib/render/primitives";

const THUMB_WIDTH = 54;
const THUMB_HEIGHT = 96;

/** Draws the source image itself — the mockup preview is the stage's job. */
function Thumbnail({ item }: { item: WallpaperItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = THUMB_WIDTH * dpr;
    canvas.height = THUMB_HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    drawCover(ctx, item.bitmap, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  }, [item.bitmap]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
      className="rounded-lg bg-ink-900"
    />
  );
}

/**
 * The batch itself: one tile per imported image, the selected one driving the
 * preview. Everything else in the panel applies to all of them at once.
 */
export function BatchStrip({
  items,
  selectedId,
  onSelect,
  onRemove,
  onAdd,
}: {
  items: WallpaperItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  const full = items.length >= MAX_BATCH_ITEMS;

  return (
    <div className="panel shrink-0 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="field-label" data-testid="batch-count">
          Lot · {items.length}/{MAX_BATCH_ITEMS} image{items.length > 1 ? "s" : ""}
        </p>
        <p className="text-xs text-ink-600">Les réglages s&apos;appliquent à tout le lot.</p>
      </div>

      <ul className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, index) => {
          const active = item.id === selectedId;
          return (
            <li key={item.id} className="relative shrink-0">
              <button
                type="button"
                data-testid="batch-thumb"
                aria-pressed={active}
                title={item.name}
                onClick={() => onSelect(item.id)}
                className={`block cursor-pointer rounded-lg p-0.5 ring-2 transition ${
                  active ? "ring-accent" : "ring-transparent hover:ring-white/25"
                }`}
              >
                <Thumbnail item={item} />
                <span className="mt-1 block w-[54px] truncate text-[10px] text-ink-400">
                  {index + 1}. {item.name}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Retirer ${item.name}`}
                onClick={() => onRemove(item.id)}
                className="absolute -right-1 -top-1 grid h-5 w-5 cursor-pointer place-items-center rounded-full border border-white/15 bg-ink-900 text-xs text-ink-400 hover:text-white"
              >
                ✕
              </button>
            </li>
          );
        })}

        <li className="shrink-0">
          <button
            type="button"
            onClick={onAdd}
            disabled={full}
            title={full ? `${MAX_BATCH_ITEMS} images maximum par lot` : undefined}
            style={{ width: THUMB_WIDTH + 4, height: THUMB_HEIGHT + 4 }}
            className="grid cursor-pointer place-items-center rounded-lg border border-dashed border-white/20 text-2xl text-ink-400 hover:border-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </li>
      </ul>
    </div>
  );
}
