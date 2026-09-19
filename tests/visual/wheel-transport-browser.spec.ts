import { expect, test } from "@playwright/test";
import { WHEEL_TRANSPORT_PARAMS } from "../../src/lib/experience/wheel-transport";

test("all live scenes share bounded wheel distance, stop, reverse and native navigation", async ({ page }, info) => {
  test.skip(!["1440x900", "1366x768", "1920x1080"].includes(info.project.name), "desktop wheel path");
  await page.goto("/?intro=0");
  await page.waitForFunction(() => !!window.__kpWheel && !!window.ScrollTrigger);
  await page.mouse.move(700, 400);
  const tracks = await page.locator("[data-track]").evaluateAll((nodes) => nodes.map((node) => {
    const el = node as HTMLElement;
    return { slug: el.dataset.track, y: el.offsetTop + el.offsetHeight * 0.5 };
  }));
  expect(tracks).toHaveLength(9);
  for (const { y, slug } of tracks) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(200);
    const start = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(350);
    const stopped = await page.evaluate(() => window.scrollY);
    expect(stopped, slug).toBeGreaterThan(start);
    expect(stopped - start, slug).toBeLessThanOrEqual(WHEEL_TRANSPORT_PARAMS.gapMax + 1);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY), slug).toBe(stopped);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY), slug).toBeLessThan(stopped);
  }
  await page.keyboard.press("Home");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test("resize to mobile releases wheel transport; return to desktop re-engages", async ({ page }, info) => {
  test.skip(info.project.name !== "1440x900", "one breakpoint traversal");
  await page.goto("/?intro=0");
  await page.waitForFunction(() => !!window.__kpWheel && !!window.ScrollTrigger);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.mouse.move(200, 300);
  const start = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.scrollY) - start).toBeGreaterThan(200);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await page.mouse.move(700, 400);
  const desktopStart = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY) - desktopStart).toBeLessThanOrEqual(WHEEL_TRANSPORT_PARAMS.gapMax + 1);
});
