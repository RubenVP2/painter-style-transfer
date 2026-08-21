import { expect, test, type Download, type Page } from "@playwright/test";
import { wallpaperFixture } from "./png";
import { readZip } from "./zip";

const image = (name: string, seed: number) => ({
  name,
  mimeType: "image/png",
  buffer: wallpaperFixture(seed),
});

const BATCH = [image("un.png", 0), image("deux.png", 1.4), image("trois.png", 2.8)];

async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Decodes exported bytes back inside the browser: size + top-left pixel. */
async function decode(page: Page, bytes: Buffer) {
  return page.evaluate(async (base64) => {
    const binary = atob(base64);
    const array = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([array]));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const [r, g, b] = ctx.getImageData(2, 2, 1, 1).data;
    return { r, g, b, width: bitmap.width, height: bitmap.height };
  }, bytes.toString("base64"));
}

async function downloadArchive(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByTestId("download-button").click();
  const file = await download;
  return { file, entries: readZip(await readDownload(file)) };
}

test.describe("traitement par lots", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("imports several files at once and reports what it received", async ({ page }) => {
    await page.setInputFiles('[data-testid="wallpaper-input"]', BATCH);

    await expect(page.getByTestId("batch-thumb")).toHaveCount(3);
    await expect(page.getByTestId("batch-count")).toHaveText("Lot · 3/24 images");
    await expect(page.getByTestId("import-report")).toHaveText("3 images ajoutées");
  });

  test("names every file it refuses instead of dropping it silently", async ({ page }) => {
    await page.setInputFiles('[data-testid="wallpaper-input"]', [
      BATCH[0],
      { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("pas une image") },
      BATCH[1],
      // The very same file again: a batch never holds a duplicate.
      BATCH[1],
    ]);

    await expect(page.getByTestId("batch-thumb")).toHaveCount(2);
    await expect(page.getByTestId("import-report")).toHaveText("2 images ajoutées · 2 ignorées");
    await expect(page.getByText("notes.txt")).toBeVisible();
    await expect(page.getByText("déjà dans le lot")).toBeVisible();
  });

  test("downloads every mockup of the batch in one ZIP", async ({ page }) => {
    await page.setInputFiles('[data-testid="wallpaper-input"]', BATCH);
    await expect(page.getByTestId("download-button")).toHaveText("Télécharger les 3 mockups (ZIP)");

    const { file, entries } = await downloadArchive(page);

    expect(file.suggestedFilename()).toBe("mockups-1080x1920-3.zip");
    expect(entries.map((entry) => entry.name)).toEqual([
      "un-mockup-1080x1920.jpg",
      "deux-mockup-1080x1920.jpg",
      "trois-mockup-1080x1920.jpg",
    ]);

    for (const entry of entries) {
      // JPEG SOI marker, then the real proof: it decodes at the TikTok size.
      expect(entry.data.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
      const decoded = await decode(page, entry.data);
      expect(decoded).toMatchObject({ width: 1080, height: 1920 });
    }
  });

  test("applies the shared settings to every image of the batch", async ({ page }) => {
    await page.setInputFiles('[data-testid="wallpaper-input"]', BATCH);

    // A flat solid background is what makes the setting unmistakable in a pixel.
    await page.getByRole("radio", { name: "Uni" }).click();
    await page.getByRole("radio", { name: "4:5" }).click();
    await page.getByRole("radio", { name: "PNG" }).click();

    const { file, entries } = await downloadArchive(page);
    expect(file.suggestedFilename()).toBe("mockups-1080x1350-3.zip");
    expect(entries).toHaveLength(3);

    for (const entry of entries) {
      const decoded = await decode(page, entry.data);
      expect(decoded).toMatchObject({ width: 1080, height: 1350 });
      // #12121a, the default solid colour, on every single export.
      expect(decoded.r).toBeLessThan(30);
      expect(decoded.b).toBeLessThan(40);
    }
  });

  test("keeps the crop per image while the settings stay shared", async ({ page }) => {
    await page.setInputFiles('[data-testid="wallpaper-input"]', BATCH);

    const zoom = page.getByRole("slider", { name: "Zoom" });
    await zoom.fill("2.5");
    await expect(page.getByText("2.50×")).toBeVisible();

    // The second image was never touched, so it keeps its own 1× crop.
    await page.getByTestId("batch-thumb").nth(1).click();
    await expect(page.getByText("1.00×")).toBeVisible();

    await page.getByTestId("batch-thumb").first().click();
    await expect(page.getByText("2.50×")).toBeVisible();
  });

  test("removing an image takes it out of the batch and out of the archive", async ({ page }) => {
    await page.setInputFiles('[data-testid="wallpaper-input"]', BATCH);
    await page.getByRole("button", { name: "Retirer deux.png" }).click();

    await expect(page.getByTestId("batch-thumb")).toHaveCount(2);
    const { entries } = await downloadArchive(page);
    expect(entries.map((entry) => entry.name)).toEqual([
      "un-mockup-1080x1920.jpg",
      "trois-mockup-1080x1920.jpg",
    ]);
  });

  test("a single image still exports as one file, not an archive", async ({ page }) => {
    await page.setInputFiles('[data-testid="wallpaper-input"]', [BATCH[0]]);
    await expect(page.getByTestId("download-button")).toHaveText("Télécharger");

    const download = page.waitForEvent("download");
    await page.getByTestId("download-button").click();
    expect((await download).suggestedFilename()).toBe("un-mockup-1080x1920.jpg");
  });
});
