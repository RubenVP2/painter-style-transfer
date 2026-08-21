import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wallpaper Mockup Studio",
  description:
    "Glisse une image, obtiens un mockup iPhone sur fond flouté, exporte en JPG prêt pour TikTok.",
};

export const viewport: Viewport = {
  themeColor: "#08080c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/*
          Loaded at runtime rather than through next/font so the Docker build
          never needs network access to Google Fonts. Apple platforms fall back
          to SF Pro, which is what the real lock screen uses anyway.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* The rule targets pages/_document; in the App Router this layout covers every page. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-full antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/70 backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-6 px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2.5 text-white">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[13px] font-bold">
                  W
                </span>
                <span className="text-sm font-semibold tracking-tight">Wallpaper Mockup Studio</span>
              </Link>
              <nav className="ml-auto flex items-center gap-1 text-sm">
                <Link
                  href="/"
                  className="rounded-lg px-3 py-1.5 font-medium text-ink-200 transition-colors hover:bg-white/8"
                >
                  Studio
                </Link>
                <Link
                  href="/prompts"
                  className="rounded-lg px-3 py-1.5 font-medium text-ink-200 transition-colors hover:bg-white/8"
                >
                  Prompts
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
