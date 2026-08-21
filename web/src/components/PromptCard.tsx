"use client";

import { useState } from "react";
import type { PainterPrompt } from "@/lib/prompts";

export function PromptCard({ prompt }: { prompt: PainterPrompt }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="panel flex flex-col p-5">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-white">{prompt.painter}</h2>
        {prompt.movement ? (
          <p className="mt-1 inline-block rounded-full bg-white/8 px-2.5 py-0.5 text-xs text-ink-400">
            {prompt.movement}
          </p>
        ) : null}
      </header>

      <pre
        className={`overflow-x-auto rounded-xl border border-white/8 bg-black/35 p-3.5 text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-200 ${
          expanded ? "" : "max-h-44 overflow-y-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
        }`}
      >
        {prompt.body}
      </pre>

      <div className="mt-3.5 flex gap-2">
        <button type="button" className="btn-ghost flex-1 py-2 text-xs" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Réduire" : "Tout afficher"}
        </button>
        <button type="button" className="btn-primary flex-1 py-2 text-xs" onClick={copy}>
          {copied ? "Copié ✓" : "Copier le prompt"}
        </button>
      </div>
    </article>
  );
}
