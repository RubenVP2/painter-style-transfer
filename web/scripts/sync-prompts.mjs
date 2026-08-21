#!/usr/bin/env node
/**
 * Copies the repository's prompt markdown into the app so it can be read at
 * build time. Strictly read-only on the source: ../prompts is never written to.
 *
 * Runs from `predev` / `prebuild`. The source directory is not always part of
 * the build context — a builder that only ships `web/` (Nixpacks, Dokploy…)
 * never sees `../prompts` — so `src/content/prompts` is committed and this
 * script only refreshes it when the source is around. If neither exists the
 * build is stopped: shipping an empty prompts page is worse than failing here.
 */
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(appRoot, "src", "content", "prompts");

// `../prompts` is the repo layout; `/prompts` is where web/Dockerfile drops it.
const sources = [resolve(appRoot, "..", "prompts"), "/prompts"];

async function markdownIn(path) {
  try {
    return (await readdir(path)).filter((name) => name.endsWith(".md"));
  } catch {
    return null;
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

let source = null;
for (const candidate of sources) {
  if (candidate !== target && (await isDirectory(candidate)) && (await markdownIn(candidate))?.length) {
    source = candidate;
    break;
  }
}

if (!source) {
  const committed = (await markdownIn(target)) ?? [];
  if (committed.length === 0) {
    console.error(
      `[sync-prompts] no prompts found: neither ${sources.join(" nor ")} nor the committed copy in ` +
        `src/content/prompts contains markdown. Build the app from a full checkout of the repository.`,
    );
    process.exit(1);
  }
  console.warn(
    `[sync-prompts] source not found — using the ${committed.length} committed prompt(s) in src/content/prompts.`,
  );
  process.exit(0);
}

const files = await markdownIn(source);

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const name of files) {
  await cp(join(source, name), join(target, name));
}

console.log(`[sync-prompts] copied ${files.length} prompt(s) from ${source} into src/content/prompts`);
