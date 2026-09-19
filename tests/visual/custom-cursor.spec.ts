import { test, expect } from "@playwright/test";

test.describe("KavachPay Custom Cursor System", () => {
  test("Desktop fine pointer enables custom cursor and sets html class", async ({ page }) => {
    await page.goto("/?intro=0");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();
    await expect(page.locator("html")).toHaveClass(/has-custom-cursor/);
    await expect(cursor).toHaveAttribute("data-mode", "cinematic");

    // Pointer-events must be none so underlying UI is never blocked
    const pointerEvents = await cursor.evaluate(
      (el) => window.getComputedStyle(el).pointerEvents,
    );
    expect(pointerEvents).toBe("none");
  });

  test("Cursor follows mouse coordinates via translate3d", async ({ page }) => {
    await page.goto("/?intro=0");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();

    await page.mouse.move(250, 180);
    await expect
      .poll(async () => cursor.evaluate((el) => el.style.transform), { timeout: 3000 })
      .toContain("translate3d(250px, 180px, 0px)");
  });

  test("Cinematic mode on landing page: hover activates registration halo and scale contraction", async ({ page }) => {
    await page.goto("/?intro=0");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();
    await expect(cursor).toHaveAttribute("data-mode", "cinematic");

    // Move over a brand button in GlobalNavbar
    const brandBtn = page.locator("[data-global-navbar] button").first();
    await brandBtn.waitFor({ state: "visible" });
    const box = await brandBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(cursor).toHaveAttribute("data-state", "hover");
    }
  });

  test("Click/pointerdown activates active state", async ({ page }) => {
    await page.goto("/?intro=0");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();

    await page.mouse.move(400, 300);
    await page.mouse.down();
    await expect(cursor).toHaveAttribute("data-state", "active");

    await page.mouse.up();
    await expect(cursor).not.toHaveAttribute("data-state", "active");
  });

  test("Product mode on dashboard: quiet cursor, smaller size, no halo", async ({ page }) => {
    await page.goto("/dashboard");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();
    await expect(cursor).toHaveAttribute("data-mode", "product");

    // Halo must be hidden in product mode
    const haloDisplay = await page.evaluate(() => {
      const halo = document.querySelector("[data-cursor-root] [class*='halo']");
      return halo ? window.getComputedStyle(halo).display : "none";
    });
    expect(haloDisplay).toBe("none");
  });

  test("Text fields switch cursor to text state and preserve native I-beam", async ({ page }) => {
    await page.goto("/dashboard");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();

    const searchInput = page.locator("input").first();
    if (await searchInput.count() > 0 && (await searchInput.isVisible())) {
      const box = await searchInput.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await expect(cursor).toHaveAttribute("data-state", "text");

        // The cursor wrapper must be hidden so native I-beam is visible
        const opacity = await cursor.evaluate((el) => window.getComputedStyle(el).opacity);
        expect(Number(opacity)).toBe(0);
      }
    }
  });

  test("Pointer leave hides cursor", async ({ page }) => {
    await page.goto("/?intro=0");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();

    await page.mouse.move(300, 200);
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent("mouseleave"));
    });
    await expect(cursor).toHaveAttribute("data-state", "hidden");
  });

  test("Scrolling on landing quiets cursor and hand movement restores it", async ({ page }) => {
    await page.goto("/?intro=0");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();

    // Trigger wheel scroll
    await page.mouse.wheel(0, 300);
    await expect(cursor).toHaveAttribute("data-scrolling", "true");

    // Moving mouse immediately clears scrolling state
    await page.mouse.move(200, 200);
    await expect(cursor).toHaveAttribute("data-scrolling", "false");
  });

  test("Coarse pointer / touch device: custom cursor is disabled and html class is not added", async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto("/?intro=0");
    await page.waitForLoadState("domcontentloaded");

    const isFine = await page.evaluate(() => window.matchMedia("(pointer: fine)").matches);
    if (!isFine) {
      const hasClass = await page.evaluate(() =>
        document.documentElement.classList.contains("has-custom-cursor"),
      );
      expect(hasClass).toBe(false);
      const cursor = page.locator("[data-cursor-root]");
      expect(await cursor.count()).toBe(0);
    }
    await context.close();
  });

  test("FilmIntro holds subdued cursor until release", async ({ page }) => {
    await page.goto("/?intro=1");
    const cursor = page.locator("[data-cursor-root]");
    await expect(cursor).toBeAttached();

    // While FilmIntro is mounted and running, data-intro is true
    const introAttr = await cursor.getAttribute("data-intro");
    expect(introAttr).toBe("true");
  });
});
