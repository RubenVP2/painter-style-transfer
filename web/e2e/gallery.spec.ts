import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import manifest from "../src/content/gallery/manifest.json";

// Playwright transpiles specs to CommonJS, so __dirname is the portable choice here.
const GALLERY_DIR = join(__dirname, "..", "public", "gallery");
const [first] = manifest;

async function openFirstCard(page: Page) {
  await page.getByTestId("wallpaper-card").first().click();
  await expect(page.getByTestId("wallpaper-dialog")).toBeVisible();
}

test.describe("galerie", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/galerie");
  });

  test("lists every wallpaper in the manifest and loads their thumbnails", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Galerie", level: 1 })).toBeVisible();

    const cards = page.getByTestId("wallpaper-card");
    await expect(cards).toHaveCount(manifest.length);

    // A tile that never decoded would still lay out correctly, hence naturalWidth.
    const decoded = await page
      .locator('[data-testid="wallpaper-card"] img')
      .first()
      .evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth));
    expect(decoded).toBeGreaterThan(0);
  });

  test("filtering by painter narrows the grid", async ({ page }) => {
    const expected = manifest.filter((item) => item.promptSlug === first.promptSlug).length;

    await page.getByRole("radio", { name: new RegExp(`^${first.painter}`) }).click();
    await expect(page.getByTestId("wallpaper-card")).toHaveCount(expected);
    await expect(page.locator(`[data-painter="${first.promptSlug}"]`)).toHaveCount(expected);

    await page.getByRole("radio", { name: /^Tous/ }).click();
    await expect(page.getByTestId("wallpaper-card")).toHaveCount(manifest.length);
  });

  test("a card opens the lightbox, which closes on Escape", async ({ page }) => {
    await openFirstCard(page);

    const dialog = page.getByTestId("wallpaper-dialog");
    await expect(dialog.getByRole("button", { name: /^Télécharger/ })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Ouvrir dans le studio" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the download is the master, byte for byte", async ({ page }) => {
    await openFirstCard(page);

    const card = page.getByTestId("wallpaper-card").first();
    const slug = await card.getAttribute("data-painter");
    const wallpaper = manifest.find((item) => item.promptSlug === slug)!;

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Télécharger/ }).click();
    const file = await download;

    expect(file.suggestedFilename()).toBe(wallpaper.file);

    const path = await file.path();
    const [served, master] = await Promise.all([
      readFile(path),
      readFile(join(GALLERY_DIR, wallpaper.file)),
    ]);

    // The promise the page makes is "no recompression" — this is what proves it.
    expect(served.length).toBe(wallpaper.bytes);
    expect(createHash("sha256").update(served).digest("hex")).toBe(
      createHash("sha256").update(master).digest("hex"),
    );
  });

  test("the studio deep link loads a gallery wallpaper straight into the canvas", async ({
    page,
  }) => {
    await page.goto(`/?w=${first.file}`);

    await expect(page.getByText("Dépose ton wallpaper")).toBeHidden();
    await expect(page.getByRole("button", { name: "Télécharger" })).toBeEnabled();
  });
});
