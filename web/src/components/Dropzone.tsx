"use client";

export function Dropzone({ onPick }: { onPick: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
      <div className="pointer-events-auto max-w-sm rounded-2xl border border-dashed border-white/20 bg-ink-900/80 p-7 text-center backdrop-blur-xl">
        <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent-soft">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-white">Dépose tes wallpapers</h2>
        <p className="mt-1.5 text-sm text-ink-400">
          Glisse une ou plusieurs images ici, colle-les avec{" "}
          <kbd className="rounded bg-white/10 px-1">⌘V</kbd>, ou parcours tes fichiers. Les réglages
          s&apos;appliquent à tout le lot.
        </p>
        <button type="button" className="btn-primary mt-5 w-full" onClick={onPick}>
          Choisir des images
        </button>
        <p className="mt-3 text-xs text-ink-600">PNG, JPG, WebP, AVIF · 25 Mo par image · 24 images max</p>
      </div>
    </div>
  );
}
