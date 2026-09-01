import { expect, test } from "@playwright/test";
import { wallpaperFixture } from "./png";

// A fake but structurally valid MP4: the client only downloads bytes, it never
// decodes them, so the signature is enough to assert the flow end to end.
const FAKE_MP4 = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
  Buffer.alloc(64, 0),
]);

test.describe("vidéo parallaxe", () => {
  test.beforeEach(async ({ page }) => {
    // The parallax service lives outside the Next.js app; the route mocks stand
    // in for it so the suite never needs docker to run.
    await page.route(/\/health$/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":"ok"}' });
    });
    await page.route(/\/render$/, async (route) => {
      await route.fulfill({ status: 200, contentType: "video/mp4", body: FAKE_MP4 });
    });
    await page.goto("/");
  });

  test("shows the fallback notice when the service is down", async ({ page }) => {
    await page.unrouteAll({ behavior: "wait" });
    await page.route(/\/health$/, async (route) => {
      await route.abort("failed");
    });
    await page.goto("/");

    await expect(page.getByTestId("parallax-unavailable")).toHaveText(
      "Service parallaxe indisponible — lance le service parallax (docker compose up parallax)",
    );
  });

  test("sends the settings to /render and downloads the resulting video", async ({ page }) => {
    await page.setInputFiles('[data-testid="wallpaper-input"]', [
      { name: "un.png", mimeType: "image/png", buffer: wallpaperFixture(0) },
    ]);

    const seenRequests: { contentType: string; hasAnimation: string; hasImage: string }[] = [];
    await page.unroute(/\/render$/);
    await page.route(/\/render$/, async (route) => {
      const body = route.request().postDataBuffer()?.toString("latin1") ?? "";
      seenRequests.push({
        contentType: route.request().headers()["content-type"] ?? "",
        hasAnimation: String(body.includes("circle")),
        hasImage: String(body.includes("image/png")),
      });
      await route.fulfill({ status: 200, contentType: "video/mp4", body: FAKE_MP4 });
    });

    const download = page.waitForEvent("download");
    await page.getByTestId("parallax-generate-button").click();
    const file = await download;

    expect(file.suggestedFilename()).toBe("parallax-circle-1080p.mp4");
    await expect(page.getByTestId("parallax-status")).toHaveText(
      "Vidéo parallaxe téléchargée.",
    );

    // The form travelled as multipart with every field the service expects.
    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0].contentType).toContain("multipart/form-data");
    expect(seenRequests[0].hasAnimation).toBe("true");
    expect(seenRequests[0].hasImage).toBe("true");
  });

  test("the button stays disabled without any image", async ({ page }) => {
    await expect(page.getByTestId("parallax-generate-button")).toBeDisabled();
  });
});
