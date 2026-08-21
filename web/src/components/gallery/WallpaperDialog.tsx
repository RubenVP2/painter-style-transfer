"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatBytes, formatDay } from "@/lib/format";
import { downloadWallpaper, FORMAT_LABELS, galleryAssetUrl, type GalleryWallpaper } from "@/lib/gallery";

export function WallpaperDialog({
  wallpaper,
  hasPrevious,
  hasNext,
  onClose,
  onNavigate,
}: {
  wallpaper: GalleryWallpaper | null;
  hasPrevious: boolean;
  hasNext: boolean;
  onClose: () => void;
  onNavigate: (delta: -1 | 1) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Tagged with the wallpaper it belongs to, so moving to the next one clears
  // it without an effect that would cascade a render.
  const [error, setError] = useState<{ slug: string; message: string } | null>(null);

  // showModal() is what gives us the focus trap, the inert backdrop and Esc for
  // free — a plain div would need all three reimplemented.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (wallpaper && !dialog.open) dialog.showModal();
    if (!wallpaper && dialog.open) dialog.close();
  }, [wallpaper]);

  useEffect(() => {
    if (!wallpaper) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onNavigate(-1);
      if (event.key === "ArrowRight") onNavigate(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wallpaper, onNavigate]);

  const download = async () => {
    try {
      await downloadWallpaper(wallpaper!);
    } catch {
      setError({
        slug: wallpaper!.slug,
        message: "Le téléchargement a échoué. Réessaie ou fais un clic droit sur l'image.",
      });
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clicking the backdrop hits the dialog element itself, never its children.
      onClick={(event) => (event.target === ref.current ? onClose() : undefined)}
      data-testid="wallpaper-dialog"
      className="m-auto max-h-[92vh] w-[min(1100px,94vw)] rounded-3xl border border-white/10 bg-ink-900/95 p-0 text-ink-200 backdrop-blur-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      {wallpaper ? (
        <div className="flex max-h-[92vh] flex-col gap-5 p-5 sm:flex-row sm:p-6">
          {/* The master is served as-is on purpose; next/image would recompress
              it and pull sharp into the Docker runtime. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={galleryAssetUrl(wallpaper.file)}
            alt={`${wallpaper.title}, dans le style de ${wallpaper.painter}`}
            className="mx-auto max-h-[45vh] w-auto rounded-2xl border border-white/8 object-contain sm:max-h-[80vh]"
          />

          <div className="flex min-w-0 flex-1 flex-col sm:max-w-xs">
            <h2 className="text-lg font-semibold tracking-tight text-white">{wallpaper.title}</h2>
            <p className="mt-1 text-sm text-ink-400">
              Style{" "}
              <Link href={`/prompts#${wallpaper.promptSlug}`} className="font-medium text-accent-soft hover:underline">
                {wallpaper.painter}
              </Link>
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div>
                <dt className="field-label">Définition</dt>
                <dd className="mt-1 text-ink-200">
                  {wallpaper.width} × {wallpaper.height}
                </dd>
              </div>
              <div>
                <dt className="field-label">Format</dt>
                <dd className="mt-1 text-ink-200">{FORMAT_LABELS[wallpaper.format]}</dd>
              </div>
              <div>
                <dt className="field-label">Poids</dt>
                <dd className="mt-1 text-ink-200">{formatBytes(wallpaper.bytes)}</dd>
              </div>
              <div>
                <dt className="field-label">Ajouté le</dt>
                <dd className="mt-1 text-ink-200">{formatDay(wallpaper.addedAt)}</dd>
              </div>
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-ink-400">
              Le fichier est servi tel quel, sans recompression : c&apos;est exactement l&apos;image
              d&apos;origine.
            </p>

            <div className="mt-auto pt-5">
              {error?.slug === wallpaper.slug ? (
                <p role="alert" className="mb-2.5 rounded-xl border border-accent/40 bg-accent/15 p-2.5 text-xs text-white">
                  {error.message}
                </p>
              ) : null}

              <button type="button" className="btn-primary w-full" onClick={download}>
                Télécharger · {FORMAT_LABELS[wallpaper.format]} · {formatBytes(wallpaper.bytes)}
              </button>

              <div className="mt-2 flex gap-2">
                <Link href={`/?w=${wallpaper.file}`} className="btn-ghost flex-1 py-2 text-xs">
                  Ouvrir dans le studio
                </Link>
                <button
                  type="button"
                  className="btn-ghost px-3 py-2 text-xs"
                  aria-label="Wallpaper précédent"
                  disabled={!hasPrevious}
                  onClick={() => onNavigate(-1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="btn-ghost px-3 py-2 text-xs"
                  aria-label="Wallpaper suivant"
                  disabled={!hasNext}
                  onClick={() => onNavigate(1)}
                >
                  →
                </button>
              </div>

              <button type="button" className="mt-2 w-full cursor-pointer py-1.5 text-xs text-ink-400 hover:text-ink-200" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
