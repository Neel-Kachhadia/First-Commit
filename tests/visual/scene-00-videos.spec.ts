import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const outVideos = path.join(process.cwd(), "output", "playwright", "videos");

test.use({ video: { mode: "on" } });

test.describe("Scene 00 Motion QA — 7 Authored Videos", () => {
  test("1. intro_to_scene00_newhero.webm @ 1440x900", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1440x900", "Targeted to 1440x900");
    await mkdir(outVideos, { recursive: true });

    await page.goto("/?intro=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);

    // Wait for intro to play completely and hero to register
    await page.locator("[data-hero-title]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(2500); // hold on registered hero

    const video = page.video();
    await page.close();
    if (video) {
      await video.saveAs(path.join(outVideos, "intro_to_scene00_newhero.webm"));
      console.log("[VIDEO SAVED] intro_to_scene00_newhero.webm");
    }
  });

  test("2. scene00_resting_motion.webm @ 1440x900", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1440x900", "Targeted to 1440x900");
    await mkdir(outVideos, { recursive: true });

    await page.goto("/?visualTest=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("[data-hero-title]").waitFor({ state: "visible" });

    // Capture resting micro-motion (sub-pixel gate weave + subtle exposure drift)
    await page.waitForTimeout(4500);

    const video = page.video();
    await page.close();
    if (video) {
      await video.saveAs(path.join(outVideos, "scene00_resting_motion.webm"));
      console.log("[VIDEO SAVED] scene00_resting_motion.webm");
    }
  });

  test("3. scene00_1366x768.webm @ 1366x768", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1366x768", "Targeted to 1366x768");
    await mkdir(outVideos, { recursive: true });

    await page.goto("/?intro=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);

    await page.locator("[data-hero-title]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(2500);

    const video = page.video();
    await page.close();
    if (video) {
      await video.saveAs(path.join(outVideos, "scene00_1366x768.webm"));
      console.log("[VIDEO SAVED] scene00_1366x768.webm");
    }
  });

  test("4. scene00_mobile_430x932.webm @ 430x932", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "430x932", "Targeted to 430x932");
    await mkdir(outVideos, { recursive: true });

    await page.goto("/?intro=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);

    await page.locator("[data-hero-title]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(2500);

    const video = page.video();
    await page.close();
    if (video) {
      await video.saveAs(path.join(outVideos, "scene00_mobile_430x932.webm"));
      console.log("[VIDEO SAVED] scene00_mobile_430x932.webm");
    }
  });

  test("5. scene00_mobile_390x844.webm @ 390x844", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "390x844", "Targeted to 390x844");
    await mkdir(outVideos, { recursive: true });

    await page.goto("/?intro=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);

    await page.locator("[data-hero-title]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(2500);

    const video = page.video();
    await page.close();
    if (video) {
      await video.saveAs(path.join(outVideos, "scene00_mobile_390x844.webm"));
      console.log("[VIDEO SAVED] scene00_mobile_390x844.webm");
    }
  });

  test("6. root_refresh_intro_replay.webm @ 1440x900", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1440x900", "Targeted to 1440x900");
    await mkdir(outVideos, { recursive: true });

    // Initial root load
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-film-intro]")).toBeVisible({ timeout: 4000 });
    await page.locator("[data-hero-title]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1000);

    // Hard browser reload of root /
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-film-intro]")).toBeVisible({ timeout: 4000 });
    await page.locator("[data-hero-title]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1500);

    const video = page.video();
    await page.close();
    if (video) {
      await video.saveAs(path.join(outVideos, "root_refresh_intro_replay.webm"));
      console.log("[VIDEO SAVED] root_refresh_intro_replay.webm");
    }
  });

  test("7. internal_navigation_no_intro_replay.webm @ 1440x900", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1440x900", "Targeted to 1440x900");
    await mkdir(outVideos, { recursive: true });

    // Load page and wait for intro release
    await page.goto("/?intro=1", { waitUntil: "domcontentloaded" });
    await page.locator("[data-hero-title]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1000);

    // Navigate to chapter 05 Revocation via navbar
    const chapter05 = page.locator("button:has-text('05 REVOCATION'), button:has-text('05')").first();
    await chapter05.click();
    await page.waitForTimeout(1500);

    // Navigate back to chapter 00 Opening / Hero via navbar
    const chapter00 = page.locator("button:has-text('00 OPENING / HERO'), button:has-text('00')").first();
    await chapter00.click();
    await page.waitForTimeout(1000);

    // Verify Scene 00 is visible and intro has NOT replayed
    await expect(page.locator("[data-hero-title]")).toBeVisible();
    await expect(page.locator("[data-film-intro]")).toHaveCount(0);
    await page.waitForTimeout(1500);

    const video = page.video();
    await page.close();
    if (video) {
      await video.saveAs(path.join(outVideos, "internal_navigation_no_intro_replay.webm"));
      console.log("[VIDEO SAVED] internal_navigation_no_intro_replay.webm");
    }
  });
});
