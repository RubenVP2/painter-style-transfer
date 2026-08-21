import type { Metadata } from "next";
import Link from "next/link";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { loadGallery } from "@/lib/gallery";

const DESCRIPTION =
  "Des wallpapers peints à la manière des grands maîtres, à télécharger en pleine qualité.";

export const metadata: Metadata = {
  title: "Galerie · Wallpaper Mockup Studio",
  description: DESCRIPTION,
  // This page exists to be shared on social networks — the card matters.
  openGraph: {
    title: "Galerie de wallpapers",
    description: DESCRIPTION,
    type: "website",
  },
};

// The manifest is bundled at build time, so nothing is read from disk at runtime.
export const dynamic = "force-static";

export default function GalleryPage() {
  const wallpapers = loadGallery();

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6">
      <header className="mb-7 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Galerie</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          {wallpapers.length} wallpaper{wallpapers.length > 1 ? "s" : ""} en 9:16, libres de
          téléchargement et servis sans recompression. Chacun est généré avec l&apos;un des{" "}
          <Link href="/prompts" className="font-medium text-accent-soft hover:underline">
            prompts du dépôt
          </Link>
          {" "}— tu peux aussi les remettre en scène dans le{" "}
          <Link href="/" className="font-medium text-accent-soft hover:underline">
            studio
          </Link>
          .
        </p>
      </header>

      {wallpapers.length === 0 ? (
        <p className="panel p-6 text-sm text-ink-400">
          La galerie est vide. Dépose tes images dans{" "}
          <code className="text-ink-200">web/public/gallery/</code> en les nommant{" "}
          <code className="text-ink-200">&lt;slug-du-prompt&gt;--&lt;titre&gt;.png</code>, puis lance{" "}
          <code className="text-ink-200">npm run gallery</code>.
        </p>
      ) : (
        <GalleryBrowser wallpapers={wallpapers} />
      )}
    </div>
  );
}
