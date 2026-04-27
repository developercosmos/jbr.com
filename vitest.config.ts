import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * TECH-02: Vitest config for unit tests on server actions.
 *
 * Run with: `npx vitest` (after `npm i -D vitest`).
 * Existing test surfaces:
 *   - src/__tests__/fees.test.ts      (fee calculator math)
 *   - src/__tests__/ledger.test.ts    (double-entry balance check)
 *
 * Playwright e2e (golden buyer/seller paths) is owned by `playwright.config.ts`
 * to be added when the test infra is provisioned. See INFRA TODO at end.
 */
export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        globals: false,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});
