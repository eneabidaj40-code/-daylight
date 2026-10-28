import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 5000 },
  reporter: "list",
  projects: [
    { name: "desktop" },
    {
      name: "phone-layout",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:4201/-daylight/",
    browserName: "chromium",
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    headless: true,
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run preview -- --port 4201 --strictPort`,
    env: { VITE_BASE_PATH: "/-daylight/" },
    url: "http://127.0.0.1:4201/-daylight/",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
