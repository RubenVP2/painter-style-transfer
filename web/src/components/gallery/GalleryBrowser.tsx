"use client";

import { useCallback, useMemo, useState } from "react";
import { galleryPainters, type GalleryWallpaper } from "@/lib/gallery";
import { PainterFilter } from "./PainterFilter";
import { WallpaperCard } from "./WallpaperCard";
import { WallpaperDialog } from "./WallpaperDialog";

/** How many tiles are mounted before the visitor asks for more. */
const BATCH = 24;

export function GalleryBrowser({ wallpapers }: { wallpapers: GalleryWallpaper[] }) {
  const [painter, setPainter] = useState<string | null>(null);
  const [shown, setShown] = useState(BATCH);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const painters = useMemo(() => galleryPainters(wallpapers), [wallpapers]);
  const filtered = useMemo(
    () => (painter ? wallpapers.filter((wallpaper) => wallpaper.promptSlug === painter) : wallpapers),
    [wallpapers, painter],
  );

  const filterBy = (next: string | null) => {
    setPainter(next);
    setShown(BATCH);
  };

  // The dialog walks the filtered list, so ←/→ stays inside what is on screen.
  const navigate = useCallback(
    (delta: -1 | 1) => {
      if (openIndex === null) return;
      const next = openIndex + delta;
      if (next < 0 || next >= filtered.length) return;
      setOpenIndex(next);
      // Keep the grid in step, so closing the dialog lands on the tile it showed.
      setShown((count) => Math.max(count, next + 1));
    },
    [openIndex, filtered.length],
  );

  const visible = filtered.slice(0, shown);

  return (
    <>
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-white/8 bg-ink-950/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <PainterFilter painters={painters} value={painter} total={wallpapers.length} onChange={filterBy} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((wallpaper, index) => (
          <WallpaperCard key={wallpaper.slug} wallpaper={wallpaper} onOpen={() => setOpenIndex(index)} />
        ))}
      </div>

      {shown < filtered.length ? (
        <div className="mt-8 text-center">
          <button type="button" className="btn-ghost" onClick={() => setShown((count) => count + BATCH)}>
            Afficher plus ({filtered.length - shown} restants)
          </button>
        </div>
      ) : null}

      <WallpaperDialog
        wallpaper={openIndex === null ? null : (filtered[openIndex] ?? null)}
        hasPrevious={openIndex !== null && openIndex > 0}
        hasNext={openIndex !== null && openIndex < filtered.length - 1}
        onClose={() => setOpenIndex(null)}
        onNavigate={navigate}
      />
    </>
  );
}
