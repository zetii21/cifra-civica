import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        "APP_ENV=test ENABLE_SYNTHETIC_SCENARIOS=true CORS_ORIGINS=http://localhost:3100 .venv/bin/python -m uvicorn --app-dir services/simulation-api app.main:app --host 127.0.0.1 --port 8000 --no-access-log",
      url: "http://localhost:8000/api/v1/ready",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        "SIMULATION_API_BASE_URL=http://localhost:8000 npm run dev -- --port 3100",
      url: "http://localhost:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
