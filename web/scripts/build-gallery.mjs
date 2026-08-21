#!/usr/bin/env node
/**
 * Builds the public gallery: derives thumbnails and writes the manifest that
 * src/app/galerie reads.
 *
 * The masters in public/gallery are the download targets and are served byte
 * for byte — this script never rewrites them. It only produces the derived
 * assets a browser needs to *display* the grid quickly:
 *
 *   public/gallery/<slug>.<ext>        master, committed, untouched
 *   public/gallery/thumbs/<slug>.webp  generated
 *   src/content/gallery/manifest.json  generated, committed
 *
 * Unlike sync-prompts.mjs this is NOT wired into predev/prebuild: sharp is a
 * devDependency and the outputs are committed, so a deploy build never needs
 * it. Run `npm run gallery` after adding files, then commit.
 *
 *   npm run gallery            regenerate what changed
 *   npm run gallery -- --check exit 1 if the manifest is stale (CI)
 *   npm run gallery -- --force rebuild every thumbnail
 */
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const galleryDir = join(appRoot, "public", "gallery");
const thumbsDir = join(galleryDir, "thumbs");
const promptsDir = join(appRoot, "src", "content", "prompts");
const manifestPath = join(appRoot, "src", "content", "gallery", "manifest.json");
const titlesPath = join(galleryDir, "titles.json");

const check = process.argv.includes("--check");
const force = process.argv.includes("--force");

/** Formats sharp reports; anything else is not a wallpaper we can serve. */
const FORMATS = { png: "png", jpeg: "jpeg", jpg: "jpeg", webp: "webp" };
const THUMB_WIDTH = 540;
/** Wide enough to hint at the composition, small enough to inline (~400 bytes). */
const BLUR_WIDTH = 20;

/** `van-gogh--terrasse-de-cafe.png` → prompt slug + kebab title. */
const NAME = /^([a-z0-9]+(?:-[a-z0-9]+)*)--([a-z0-9]+(?:-[a-z0-9]+)*)$/;

function fail(message) {
  console.error(`[build-gallery] ${message}`);
  process.exit(1);
}

async function readdirOr(path, fallback) {
  try {
    return await readdir(path);
  } catch {
    return fallback;
  }
}

async function readJsonOr(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

/** `# Vincent van Gogh — Post-impressionnisme` — same heading shape as lib/prompts.ts. */
async function loadPainters() {
  const files = (await readdirOr(promptsDir, [])).filter((name) => name.endsWith(".md"));
  const painters = new Map();

  for (const name of files) {
    const markdown = await readFile(join(promptsDir, name), "utf8");
    const heading = /^#\s+(.+?)\s*(?:[—–-]\s*(.+))?$/m.exec(markdown);
    const slug = name.replace(/\.md$/, "");
    painters.set(slug, heading?.[1]?.trim() ?? slug);
  }

  return painters;
}

function titleFromSlug(slug) {
  const words = slug.split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function buildEntry(file, painters, titles, previous) {
  const extension = extname(file).slice(1).toLowerCase();
  const slug = file.slice(0, -(extension.length + 1));
  const match = NAME.exec(slug);

  if (!match) {
    fail(
      `"${file}" does not follow the <prompt-slug>--<kebab-title>.<ext> convention. ` +
        `Rename it, e.g. van-gogh--terrasse-de-cafe.png.`,
    );
  }

  const [, promptSlug, titleSlug] = match;
  if (!painters.has(promptSlug)) {
    fail(
      `"${file}" claims the prompt "${promptSlug}", which has no match in src/content/prompts. ` +
        `Known prompts: ${[...painters.keys()].join(", ")}.`,
    );
  }

  const source = join(galleryDir, file);
  const { size: bytes, mtime } = await stat(source);
  const image = sharp(source, { limitInputPixels: false });
  const { width, height, format } = await image.metadata();

  if (!FORMATS[format]) {
    fail(`"${file}" is a ${format} — only PNG, JPEG and WebP can be published.`);
  }

  const thumb = `thumbs/${slug}.webp`;
  const thumbPath = join(galleryDir, thumb);
  // The master is immutable under a given name, so an entry whose byte count
  // still matches has nothing to regenerate. Keeps repeat runs near-instant
  // once the gallery holds hundreds of files.
  const cached = previous.get(slug);
  const reusable = !force && cached?.bytes === bytes && (await stat(thumbPath).catch(() => null));

  let derived;
  if (reusable) {
    derived = { thumb, thumbWidth: cached.thumbWidth, thumbHeight: cached.thumbHeight, blur: cached.blur };
  } else {
    const { data, info } = await image
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    if (!check) {
      await mkdir(thumbsDir, { recursive: true });
      await writeFile(thumbPath, data);
    }

    const blur = await sharp(source, { limitInputPixels: false })
      .resize({ width: BLUR_WIDTH })
      .webp({ quality: 40, alphaQuality: 40 })
      .toBuffer();

    derived = {
      thumb,
      thumbWidth: info.width,
      thumbHeight: info.height,
      blur: `data:image/webp;base64,${blur.toString("base64")}`,
    };
  }

  return {
    slug,
    title: titles[slug] ?? titleFromSlug(titleSlug),
    painter: painters.get(promptSlug),
    promptSlug,
    file,
    format: FORMATS[format],
    bytes,
    width,
    height,
    ...derived,
    // The file's own timestamp, so re-running the script never reshuffles the grid.
    addedAt: (cached?.addedAt ?? mtime.toISOString()).slice(0, 10),
  };
}

const painters = await loadPainters();
if (painters.size === 0) {
  fail("no prompts in src/content/prompts — run `node scripts/sync-prompts.mjs` first.");
}

const files = (await readdirOr(galleryDir, [])).filter((name) => extname(name).slice(1).toLowerCase() in FORMATS).sort();
const titles = await readJsonOr(titlesPath, {});
const previous = new Map((await readJsonOr(manifestPath, [])).map((entry) => [entry.slug, entry]));

const entries = [];
for (const file of files) {
  entries.push(await buildEntry(file, painters, titles, previous));
}

// Newest first, then alphabetically so same-day additions keep a stable order.
entries.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.slug.localeCompare(b.slug));

const serialised = `${JSON.stringify(entries, null, 2)}\n`;

if (check) {
  const current = await readFile(manifestPath, "utf8").catch(() => null);
  if (current !== serialised) {
    fail("manifest is stale — run `npm run gallery` and commit the result.");
  }
  const thumbs = new Set(await readdirOr(thumbsDir, []));
  const orphans = [...thumbs].filter((name) => !entries.some((entry) => entry.thumb === `thumbs/${name}`));
  const missing = entries.filter((entry) => !thumbs.has(entry.thumb.slice("thumbs/".length)));
  if (orphans.length > 0 || missing.length > 0) {
    fail(
      `thumbnails out of sync — missing: ${missing.map((entry) => entry.slug).join(", ") || "none"}; ` +
        `orphaned: ${orphans.join(", ") || "none"}. Run \`npm run gallery\`.`,
    );
  }
  console.log(`[build-gallery] manifest up to date (${entries.length} wallpaper(s)).`);
  process.exit(0);
}

// A thumbnail whose master is gone would otherwise linger in the Docker image.
for (const name of await readdirOr(thumbsDir, [])) {
  if (!entries.some((entry) => entry.thumb === `thumbs/${name}`)) {
    await rm(join(thumbsDir, name));
    console.log(`[build-gallery] removed orphan thumbnail ${name}`);
  }
}

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, serialised);

console.log(`[build-gallery] ${entries.length} wallpaper(s) written to src/content/gallery/manifest.json`);
