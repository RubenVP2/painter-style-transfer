import type { Metadata } from "next";
import Link from "next/link";
import { PromptCard } from "@/components/PromptCard";
import { loadPrompts } from "@/lib/prompts";

export const metadata: Metadata = {
  title: "Prompts · Wallpaper Mockup Studio",
  description: "Les prompts de style transfer du dépôt, prêts à copier.",
};

// The markdown is read from disk at build time, so nothing has to exist at runtime.
export const dynamic = "force-static";

export default async function PromptsPage() {
  const prompts = await loadPrompts();

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Prompts de style transfer</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          Les {prompts.length} prompts du dépôt, en lecture seule. Génère ton image avec l&apos;un
          d&apos;eux, puis reviens dans le{" "}
          <Link href="/" className="font-medium text-accent-soft hover:underline">
            studio
          </Link>{" "}
          pour la mettre en scène.
        </p>
      </header>

      {prompts.length === 0 ? (
        <p className="panel p-6 text-sm text-ink-400">
          Aucun prompt trouvé. Lance <code className="text-ink-200">node scripts/sync-prompts.mjs</code>{" "}
          depuis <code className="text-ink-200">web/</code> pour recopier <code className="text-ink-200">../prompts</code>.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {prompts.map((prompt) => (
            <PromptCard key={prompt.slug} prompt={prompt} />
          ))}
        </div>
      )}
    </div>
  );
}
