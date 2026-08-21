import { expect, test, type Download, type Page } from "@playwright/test";
import { wallpaperFixture } from "./png";

const WALLPAPER = { name: "fixture.png", mimeType: "image/png", buffer: wallpaperFixture() };

async function dropWallpaper(page: Page) {
  await page.setInputFiles('[data-testid="wallpaper-input"]', WALLPAPER);
  await expect(page.getByText("Dépose tes wallpapers")).toBeHidden();
}

/** Samples the preview canvas so we can tell "drew something" from "stayed blank". */
async function canvasStats(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="mockup-canvas"]')!;
    const ctx = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set<number>();
    let sum = 0;
    for (let i = 0; i < data.length; i += 4 * 97) {
      seen.add((data[i] >> 3) * 1024 + (data[i + 1] >> 3) * 32 + (data[i + 2] >> 3));
      sum += data[i] + data[i + 1] + data[i + 2];
    }
    return { width: canvas.width, height: canvas.height, colours: seen.size, sum };
  });
}


async function topLeftPixel(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="mockup-canvas"]')!;
    const [r, g, b] = canvas.getContext("2d")!.getImageData(2, 2, 1, 1).data;
    return { r, g, b };
  });
}

async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Decodes an exported file back inside the browser and reads its top-left pixel. */
async function samplePixelFromBytes(page: Page, bytes: Buffer) {
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

test.describe("studio", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("starts empty and renders a mockup once a wallpaper is dropped", async ({ page }) => {
    await expect(page.getByText("Dépose tes wallpapers")).toBeVisible();

    const before = await canvasStats(page);
    await dropWallpaper(page);
    const after = await canvasStats(page);

    expect(after.width).toBeGreaterThan(0);
    // The empty state is a flat dark gradient; a real wallpaper is far richer.
    expect(after.colours).toBeGreaterThan(before.colours);
    expect(after.colours).toBeGreaterThan(20);
  });

  test("the safe-zone overlay shows in the preview but is absent from the export", async ({
    page,
  }) => {
    await dropWallpaper(page);
    // A flat dark background makes the pink guide tint unambiguous to detect.
    await page.getByRole("radio", { name: "Uni" }).click();
    await page.getByText("Zones sûres TikTok").click();

    const preview = await topLeftPixel(page);
    expect(preview.r - preview.b).toBeGreaterThan(12);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Télécharger" }).click();
    const bytes = await readDownload(await download);

    const exported = await samplePixelFromBytes(page, bytes);
    expect(exported.r - exported.b).toBeLessThan(6);
  });

  test("exports a JPG at the TikTok resolution", async ({ page }) => {
    await dropWallpaper(page);
    await expect(page.getByText(/1080×1920px · JPG/)).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Télécharger" }).click();
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/^fixture-mockup-1080x1920\.jpg$/);
    const bytes = await readDownload(file);

    expect(bytes.length).toBeGreaterThan(1000);
    // JPEG SOI marker.
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  test("switching to PNG changes the export format", async ({ page }) => {
    await dropWallpaper(page);
    await page.getByRole("radio", { name: "PNG" }).click();
    await expect(page.getByText(/1080×1920px · PNG/)).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Télécharger" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
  });

  test("the 4:5 preset resizes the export", async ({ page }) => {
    await dropWallpaper(page);
    await page.getByRole("radio", { name: "4:5" }).click();
    await expect(page.getByText(/1080×1350px · JPG/)).toBeVisible();
  });
});

test.describe("studio sur mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("le canvas d'aperçu a une taille visible et rend le mockup", async ({ page }) => {
    await page.goto("/");
    await dropWallpaper(page);

    const stats = await canvasStats(page);
    // Avant le fix la zone d'aperçu s'effondrait et le canvas restait en 1×1 ;
    // ici on vérifie qu'il a bien une vraie surface et qu'il dessine le mockup.
    expect(stats.width).toBeGreaterThan(100);
    expect(stats.height).toBeGreaterThan(100);
    expect(stats.colours).toBeGreaterThan(20);
  });
});

test("the prompts page lists every prompt in the repository", async ({ page }) => {
  await page.goto("/prompts");

  await expect(page.getByRole("heading", { name: "Prompts de style transfer" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Vincent van Gogh" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Katsushika Hokusai" })).toBeVisible();
});
