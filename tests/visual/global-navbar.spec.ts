import { expect, test } from "@playwright/test";
import { readOwnership } from "./helpers/ownership";

const desktopOnly = new Set(["1440x900"]);
const mobileOnly = new Set(["390x844"]);

test.describe("Global KavachPay navbar", () => {
  test("single desktop control surface, canonical chapters, nonlinear navigation, honest actions", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop navbar gate.");
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const nav = page.locator("[data-global-navbar]");
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("button", { name: "KAVACHPAY", exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Enter KavachPay" })).toBeVisible();

    // Distant, nonlinear jumps -- under the isolated-scene model a direct chapter
    // click must resolve in one step with exactly one scene root ever visible,
    // never a visible pass-through of the scenes scrolled over to get there.
    const sequence = ["05", "02", "08", "01", "07", "03", "06", "00"];
    for (const number of sequence) {
      const button = nav.locator(`button[aria-label^='${number} ']`);
      await button.click();
      await expect(page).toHaveURL(new RegExp(`#scene-${number}$`));
      await expect(button).toHaveAttribute("aria-current", "page");
      await expect(page.locator("[data-global-navbar] [aria-current='page']")).toHaveCount(1);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `scene ${number}: ${JSON.stringify(o.roots)}`).toBe(1);
    }

    for (const label of ["Login", "Sign up", "Enter KavachPay"]) {
      const action = nav.getByRole("button", { name: label });
      await expect(action).toHaveAttribute("aria-disabled", "true");
      // aria-disabled (unlike the native disabled attribute) does not block a
      // real pointer click in the browser; force bypasses Playwright's
      // actionability guard so we can verify the graceful-notice fallback.
      await action.click({ force: true });
      await expect(nav.getByRole("status")).toContainText("not implemented");
    }
  });

  test("deep hash load initializes the authoritative chapter without an opening flash", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop deep-load gate.");
    await page.goto("/?visualTest=1#scene-08", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const nav = page.locator("[data-global-navbar]");
    await expect(nav.getByRole("button", { name: /^08 / })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("[data-cinematic-stage]")).toHaveAttribute("data-active-scene", "causalReplay");
    await page.reload({ waitUntil: "networkidle" });
    await expect(nav.getByRole("button", { name: /^08 / })).toHaveAttribute("aria-current", "page");
  });

  test("mobile Control Index traps focus, locks film, restores scroll, and navigates", async ({ page }, testInfo) => {
    test.skip(!mobileOnly.has(testInfo.project.name), "Representative mobile control-index gate.");
    await page.goto("/?visualTest=1#scene-05", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const nav = page.locator("[data-global-navbar]");
    const trigger = nav.getByRole("button", { name: "CONTROL INDEX" });
    const before = await page.evaluate(() => window.scrollY);

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("dialog", { name: "KavachPay Control Index" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);

    await trigger.click();
    await nav.locator("[data-mobile-chapter]", { hasText: "CAUSAL REPLAY" }).click();
    await expect(page).toHaveURL(/#scene-08$/);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(nav.getByText("08 / CAUSAL REPLAY", { exact: true })).toBeVisible();
  });
});

test("obsolete per-scene upper metadata bars are absent", async ({ page }, testInfo) => {
  test.skip(!desktopOnly.has(testInfo.project.name), "One DOM invariant run is sufficient.");
  await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
  const obsoleteSelectors = [
    "[data-opening-index]",
    "[data-opening-system]",
    "[data-mandate-topline]",
    "[data-decision-register-outgoing]",
    "[data-decision-register]",
    "[data-authority-folio-outgoing]",
    "[data-authority-folio]",
    "[data-revocation-folio]",
    "[data-split-folio]",
    "[data-concurrency-folio]",
  ];
  await expect(page.locator(obsoleteSelectors.join(","))).toHaveCount(0);
  await expect(page.locator("[data-replay-docket]")).toHaveCount(1);
});
