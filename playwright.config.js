import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3002",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: "PORT=3002 npm start",
    url: "http://127.0.0.1:3002",
    reuseExistingServer: false,
  },
});
