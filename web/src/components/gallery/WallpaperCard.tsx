"use client";

import { useState } from "react";
import { galleryAssetUrl, type GalleryWallpaper } from "@/lib/gallery";

export function WallpaperCard({
  wallpaper,
  onOpen,
}: {
  wallpaper: GalleryWallpaper;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="wallpaper-card"
      data-painter={wallpaper.promptSlug}
      aria-label={`${wallpaper.title} — ${wallpaper.painter}`}
      className="group relative block aspect-9/16 w-full cursor-pointer overflow-hidden rounded-2xl border border-white/8 bg-ink-850 text-left transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:-translate-y-0.5"
      // The inline placeholder keeps the tile coloured until the thumbnail
      // arrives, so a long scroll never shows a wall of empty boxes.
      style={{ backgroundImage: `url("${wallpaper.blur}")`, backgroundSize: "cover" }}
    >
      {/* Thumbnails are already generated at their display size by
          scripts/build-gallery.mjs, so next/image would only add a runtime
          dependency on sharp for nothing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={galleryAssetUrl(wallpaper.thumb)}
        alt=""
        width={wallpaper.thumbWidth}
        height={wallpaper.thumbHeight}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />

      {/* Always visible: on touch there is no hover to reveal it with. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3 pt-8">
        <span className="block truncate text-[13px] font-semibold text-white">{wallpaper.title}</span>
        <span className="block truncate text-[11px] text-ink-200/70">{wallpaper.painter}</span>
      </span>
    </button>
  );
}
