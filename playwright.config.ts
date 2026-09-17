import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const viewports = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "430x932", width: 430, height: 932 },
  { name: "390x844", width: 390, height: 844 },
] as const;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 2,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: "output/playwright/test-results",
  preserveOutput: "always",
  reporter: [["list"]],
  use: {
    baseURL,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    screenshot: "off",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: viewports.map(({ name, width, height }) => ({
    name,
    use: { viewport: { width, height } },
  })),
});
