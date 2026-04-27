import { defineConfig, devices } from "@playwright/test";

/**
 * TECH-02: Playwright config for buyer/seller golden-path e2e.
 *
 * Run locally:   npx playwright install chromium  (one-time)
 *                npm run e2e
 * Run in CI:     PLAYWRIGHT_BASE_URL=https://staging.jualbeliraket.com npm run e2e
 *
 * Tests live in `e2e/`. Individual specs guard against unavailable services
 * (e.g., DB seeded with the test fixture) so a missing fixture skips rather
 * than fails the suite.
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
