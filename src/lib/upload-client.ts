"use client";

/**
 * Client-side uploader for /api/upload.
 *
 * Mirrors the variant-image uploader (VariantMatrixEditor.uploadColorImage),
 * which uploads reliably in ONE shot: a plain `fetch` (not XHR). The only
 * addition is a single automatic retry on a genuine network failure — `fetch`
 * rejects only when no HTTP response arrives (connection dropped), never on a
 * 4xx/5xx status — so a transient drop behind the CDN/tunnel doesn't force the
 * user to upload twice.
 */
async function postOnce(file: File, folder: string): Promise<{ url?: string; error?: string; status: number }> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    let body: { url?: string; error?: string } = {};
    try {
        body = await res.json();
    } catch {
        // non-JSON body (e.g. an nginx/Cloudflare error page)
    }
    return { url: body.url, error: body.error, status: res.status };
}

/** Upload a single file and return its public URL, or throw on a real failure. */
export async function uploadToServer(file: File, folder: string): Promise<string> {
    let res: { url?: string; error?: string; status: number };
    try {
        res = await postOnce(file, folder);
    } catch (e) {
        // Network-level failure (no response) — the file may have landed but the
        // reply was lost. One automatic retry beats a manual re-upload.
        // eslint-disable-next-line no-console
        console.warn("[upload] network error, retrying once:", e);
        res = await postOnce(file, folder);
    }
    if (!res.url) {
        if (res.status === 429) throw new Error("Terlalu banyak request. Tunggu sebentar lalu coba lagi.");
        throw new Error(res.error || (res.status === 413 ? "File terlalu besar untuk server." : "Upload gagal."));
    }
    return res.url;
}
