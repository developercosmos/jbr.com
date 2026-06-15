"use client";

/**
 * Robust client-side uploader for /api/upload.
 *
 * Why this exists: behind a CDN/tunnel (Cloudflare → cloudflared → nginx), the
 * RESPONSE to a successful upload can be dropped in transit — the file lands on
 * the server but the browser never sees the reply. With a plain `fetch`, that
 * surfaces as an error and the user re-uploads ("harus 2x upload"). Here we use
 * XHR (real progress events) and auto-retry ONCE on a transient network failure
 * (never on a 4xx), so a single user action reliably succeeds.
 */

/** No HTTP response arrived (connection dropped / timeout) — safe to retry. */
class UploadNetworkError extends Error {}

function postOnce(
    file: File,
    folder: string,
    onProgress?: (pct: number) => void
): Promise<{ url?: string; error?: string; status: number }> {
    return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", folder);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        // Parse the body from responseText ourselves (NOT responseType="json")
        // so a proxy/CDN that strips or rewrites the Content-Type can't leave
        // xhr.response null — the classic "200 but no url" drop.
        if (onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            };
        }
        xhr.onload = () => {
            let body: { url?: string; error?: string } = {};
            try {
                if (xhr.responseText) body = JSON.parse(xhr.responseText);
            } catch {
                // non-JSON body (e.g. an nginx/Cloudflare error page)
            }
            // 200 with no usable url means the success body was lost in transit —
            // treat it as a transient drop so the caller's retry kicks in.
            if (xhr.status === 200 && !body.url) {
                reject(new UploadNetworkError("Respons upload kosong (body hilang)."));
                return;
            }
            resolve({ url: body.url, error: body.error, status: xhr.status });
        };
        xhr.onerror = () => reject(new UploadNetworkError("Koneksi terputus saat mengunggah."));
        xhr.ontimeout = () => reject(new UploadNetworkError("Upload melebihi batas waktu."));
        xhr.timeout = 120_000;
        xhr.send(fd);
    });
}

/**
 * Upload a single file and return its public URL. Throws on a real failure
 * (4xx/empty result) after one automatic retry for transient network drops.
 */
export async function uploadToServer(
    file: File,
    folder: string,
    onProgress?: (pct: number) => void
): Promise<string> {
    let res: { url?: string; error?: string; status: number };
    try {
        res = await postOnce(file, folder, onProgress);
    } catch (e) {
        if (!(e instanceof UploadNetworkError)) throw e;
        // The file may already be on the server, but the client never saw the
        // reply. One automatic retry beats making the user upload again by hand.
        // eslint-disable-next-line no-console
        console.warn("[upload] network error, retrying once:", e.message);
        onProgress?.(0);
        res = await postOnce(file, folder, onProgress);
    }
    if (!res.url) {
        if (res.status === 429) throw new Error("Terlalu banyak request. Tunggu sebentar lalu coba lagi.");
        throw new Error(res.error || (res.status === 413 ? "File terlalu besar untuk server." : "Upload gagal."));
    }
    return res.url;
}
