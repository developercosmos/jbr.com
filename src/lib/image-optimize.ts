import "server-only";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const run = promisify(execFile);
const SCALE = "scale='min(2048,iw)':'min(2048,ih)':force_original_aspect_ratio=decrease";

/**
 * Optimize a raster image buffer with ffmpeg: resize to a 2048px max edge + recompress
 * (same format). ffmpeg runs on ANY CPU (unlike sharp's prebuilt, which needs
 * x86-64-v2 / Wasm-SIMD that the prod VM lacks — see project_jbr_image_optimizer_cpu).
 * Best-effort: returns the ORIGINAL buffer on any failure or if the result isn't
 * smaller. Non-raster types pass through unchanged.
 */
export async function optimizeImageBuffer(buffer: Buffer | Uint8Array, mime: string): Promise<Uint8Array> {
    const m = (mime || "").toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(m)) return buffer;

    const ext = m === "image/png" ? ".png" : m === "image/webp" ? ".webp" : ".jpg";
    const rnd = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const inTmp = path.join(os.tmpdir(), `up-in-${rnd}${ext}`);
    const outTmp = path.join(os.tmpdir(), `up-out-${rnd}${ext}`);
    const args =
        ext === ".png"
            ? ["-hide_banner", "-loglevel", "error", "-y", "-i", inTmp, "-vf", SCALE, "-c:v", "png", "-compression_level", "9", outTmp]
            : ext === ".webp"
                ? ["-hide_banner", "-loglevel", "error", "-y", "-i", inTmp, "-vf", SCALE, "-c:v", "libwebp", "-quality", "82", outTmp]
                : ["-hide_banner", "-loglevel", "error", "-y", "-i", inTmp, "-vf", SCALE, "-qscale:v", "4", outTmp];

    try {
        await fs.writeFile(inTmp, buffer);
        await run("ffmpeg", args, { timeout: 60_000 });
        const out = await fs.readFile(outTmp);
        return out.length > 0 && out.length < buffer.length ? out : buffer;
    } catch {
        return buffer;
    } finally {
        await fs.unlink(inTmp).catch(() => {});
        await fs.unlink(outTmp).catch(() => {});
    }
}
