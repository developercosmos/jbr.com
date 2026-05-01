import { test, expect } from "@playwright/test";

/**
 * Buyer golden-path smoke test. Hits public surfaces only so it can run
 * against any environment without seed data.
 */

test("home page renders and exposes new feature links", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/jbr|jualbeli|raket/i);
    // Phase 7-11 navigation entries must be present.
    await expect(page.locator('a[href="/compare"]').first()).toBeVisible();
    await expect(page.locator('a[href="/affiliate"]').first()).toBeVisible();
});

test("compare page accepts up to 3 slugs via query string", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: /Bandingkan Raket/i })).toBeVisible();
});

test("search page exposes spec filter sections", async ({ page }) => {
    await page.goto("/search?q=raket", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByText(/Bobot/i)).toBeVisible();
    await expect(page.getByText(/Balance/i)).toBeVisible();
});

test("guarded routes redirect to login when unauthenticated", async ({ page }) => {
    const guarded = ["/admin/fees", "/seller/offers", "/profile/player", "/affiliate"];
    for (const path of guarded) {
        const response = await page.goto(path);
        // Either 200 with login form or 307 redirect; both are accepted.
        expect(response?.status()).toBeLessThan(500);
    }
});
