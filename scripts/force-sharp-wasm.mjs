/**
 * postinstall: make sharp run on CPUs without x86-64-v2 (the prod VM exposes a
 * minimal "Common KVM processor" / v1, so the prebuilt @img/sharp-linux-x64 loads
 * then bails on the _isUsingX64V2() check, never reaching sharp's wasm fallback).
 *
 * On linux we install the pure-WebAssembly backend (@img/sharp-wasm32, runs on any
 * CPU) and remove the native x64 package so sharp's loader falls through to wasm.
 * Other platforms (local Windows/mac dev) are left untouched — they use native sharp.
 *
 * Idempotent + non-fatal: never fails the install. Once the VM gets a v2+ CPU, set
 * FORCE_SHARP_WASM=0 (or delete this postinstall) to go back to fast native sharp.
 */
import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";

const SHARP_VERSION = "0.34.5";

if (process.platform !== "linux" || process.env.FORCE_SHARP_WASM === "0") {
    process.exit(0);
}

const imgDir = path.resolve(process.cwd(), "node_modules", "@img");
const wasmDir = path.join(imgDir, "sharp-wasm32");

try {
    if (!existsSync(wasmDir)) {
        console.log("[force-sharp-wasm] installing @img/sharp-wasm32 (WebAssembly backend)…");
        execSync(`npm install --no-save --no-audit --no-fund --cpu=wasm32 --os=linux @img/sharp-wasm32@${SHARP_VERSION}`, {
            stdio: "inherit",
        });
    }
    if (existsSync(wasmDir)) {
        for (const native of ["sharp-linux-x64", "sharp-linuxmusl-x64"]) {
            const p = path.join(imgDir, native);
            if (existsSync(p)) {
                rmSync(p, { recursive: true, force: true });
                console.log(`[force-sharp-wasm] removed @img/${native} → sharp will use wasm32`);
            }
        }
        console.log("[force-sharp-wasm] sharp backend = WebAssembly (works on any CPU; slower than native).");
    } else {
        console.warn("[force-sharp-wasm] @img/sharp-wasm32 unavailable; leaving native sharp in place.");
    }
} catch (e) {
    console.warn("[force-sharp-wasm] non-fatal:", e?.message ?? e);
}
process.exit(0);
