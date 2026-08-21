#!/usr/bin/env node
/**
 * Copies the repository's prompt markdown into the app so it can be read at
 * build time. Strictly read-only on the source: ../prompts is never written to.
 *
 * Runs from `predev` / `prebuild`. If the source directory is missing (someone
 * copied web/ out of the repo), we warn and leave whatever is already there
 * rather than failing the build.
 */
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(appRoot, "..", "prompts");
const target = join(appRoot, "src", "content", "prompts");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(source))) {
  console.warn(`[sync-prompts] ${source} not found — keeping existing copy.`);
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

const files = (await readdir(source)).filter((name) => name.endsWith(".md"));
for (const name of files) {
  await cp(join(source, name), join(target, name));
}

console.log(`[sync-prompts] copied ${files.length} prompt(s) into src/content/prompts`);
