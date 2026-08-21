import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type PainterPrompt = {
  slug: string;
  painter: string;
  movement: string;
  body: string;
};

const PROMPTS_DIR = join(process.cwd(), "src", "content", "prompts");

/** `# Vincent van Gogh — Post-impressionnisme` */
const HEADING = /^#\s+(.+?)\s*(?:[—–-]\s*(.+))?$/m;
/** The prompt itself is the file's single fenced block. */
const FENCE = /```[a-z]*\n([\s\S]*?)```/;

function parse(slug: string, markdown: string): PainterPrompt {
  const heading = HEADING.exec(markdown);
  const fence = FENCE.exec(markdown);

  return {
    slug,
    painter: heading?.[1]?.trim() ?? slug,
    movement: heading?.[2]?.trim() ?? "",
    // Section headers inside the block vary between painters, so the body is
    // kept verbatim rather than parsed.
    body: (fence?.[1] ?? markdown).trim(),
  };
}

/**
 * Reads the prompts copied in from ../prompts by scripts/sync-prompts.mjs.
 * Runs at build time only — the page that calls it is statically rendered.
 */
export async function loadPrompts(): Promise<PainterPrompt[]> {
  let files: string[];
  try {
    files = (await readdir(PROMPTS_DIR)).filter((name) => name.endsWith(".md")).sort();
  } catch {
    return [];
  }

  return Promise.all(
    files.map(async (name) => parse(name.replace(/\.md$/, ""), await readFile(join(PROMPTS_DIR, name), "utf8"))),
  );
}
