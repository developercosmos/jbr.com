"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Trash2, Upload, Video } from "lucide-react";

interface Props {
    videoUrl: string;
    onChange: (url: string) => void;
    /** Configurable limits (accounting_settings: product.video_max_mb / product.video_max_seconds). */
    maxMb: number;
    maxSeconds: number;
}

/** Read the duration (seconds) of a local video file via metadata — no upload needed. */
function readVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(probe.duration);
        };
        probe.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("File video tidak dapat dibaca."));
        };
        probe.src = url;
    });
}

/**
 * Fallback duration probe for MP4/MOV (ISO BMFF): parses moov→mvhd straight from
 * the file bytes. Works even when CSP blocks blob: media or the codec can't decode.
 */
async function readIsoBmffDuration(file: File): Promise<number | null> {
    try {
        const buf = new DataView(await file.arrayBuffer());
        const len = buf.byteLength;
        const boxType = (off: number) =>
            String.fromCharCode(buf.getUint8(off), buf.getUint8(off + 1), buf.getUint8(off + 2), buf.getUint8(off + 3));
        // Scan boxes in [start, end) for `want`; returns payload [start, end) or null.
        const findBox = (start: number, end: number, want: string): [number, number] | null => {
            let off = start;
            while (off + 8 <= end) {
                let size = buf.getUint32(off);
                const name = boxType(off + 4);
                let header = 8;
                if (size === 1) {
                    if (off + 16 > end) return null;
                    size = buf.getUint32(off + 8) * 4294967296 + buf.getUint32(off + 12);
                    header = 16;
                } else if (size === 0) {
                    size = end - off; // box extends to end of scope
                }
                if (size < header) return null;
                if (name === want) return [off + header, Math.min(off + size, end)];
                off += size;
            }
            return null;
        };
        const moov = findBox(0, len, "moov");
        if (!moov) return null;
        const mvhd = findBox(moov[0], moov[1], "mvhd");
        if (!mvhd) return null;
        const version = buf.getUint8(mvhd[0]);
        let timescale: number;
        let duration: number;
        if (version === 1) {
            timescale = buf.getUint32(mvhd[0] + 20);
            duration = buf.getUint32(mvhd[0] + 24) * 4294967296 + buf.getUint32(mvhd[0] + 28);
        } else {
            timescale = buf.getUint32(mvhd[0] + 12);
            duration = buf.getUint32(mvhd[0] + 16);
            if (duration === 0xffffffff) return null; // unknown per spec
        }
        if (!timescale || !Number.isFinite(duration)) return null;
        return duration / timescale;
    } catch {
        return null;
    }
}

/** Network-level failure (no HTTP response) — safe to retry automatically. */
class UploadNetworkError extends Error {}

/**
 * Upload via XHR so we get real progress events (fetch has no upload progress).
 * A multi-MB POST with zero feedback looks hung, which made users re-upload a
 * file that had in fact landed on the server.
 */
function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ url?: string; error?: string; status: number }> {
    return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "product-videos");
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        xhr.responseType = "json";
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            const body = (xhr.response ?? {}) as { url?: string; error?: string };
            resolve({ url: body.url, error: body.error, status: xhr.status });
        };
        xhr.onerror = () => reject(new UploadNetworkError("Koneksi terputus saat mengunggah."));
        xhr.ontimeout = () => reject(new UploadNetworkError("Upload melebihi batas waktu."));
        xhr.timeout = 120_000;
        xhr.send(fd);
    });
}

export default function ProductVideoUpload({ videoUrl, onChange, maxMb, maxSeconds }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadedInfo, setUploadedInfo] = useState("");
    const [error, setError] = useState("");

    async function handleFile(file: File) {
        setError("");
        setUploadedInfo("");

        if (!file.type.startsWith("video/")) {
            setError("Format harus video (MP4/WEBM/MOV).");
            return;
        }
        if (file.size > maxMb * 1024 * 1024) {
            setError(`Ukuran video maksimal ${maxMb} MB. File Anda: ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
            return;
        }
        // Duration check: <video> metadata first, then byte-level MP4/MOV parse
        // (CSP/codec-immune). If neither can read it, proceed — server still
        // enforces the size cap, which bounds duration in practice.
        let duration: number | null = null;
        try {
            duration = await readVideoDuration(file);
        } catch {
            duration = await readIsoBmffDuration(file);
        }
        if (duration != null && Number.isFinite(duration) && duration > maxSeconds) {
            setError(`Durasi video maksimal ${maxSeconds} detik. Video Anda: ${Math.round(duration)} detik.`);
            return;
        }

        setUploading(true);
        setProgress(0);
        try {
            let res: { url?: string; error?: string; status: number };
            try {
                res = await uploadWithProgress(file, setProgress);
            } catch (e) {
                // Transient network drop on the response path: the file may have
                // landed server-side, but the client never saw it. One automatic
                // retry beats asking the user to upload "again" by hand.
                if (!(e instanceof UploadNetworkError)) throw e;
                console.warn("[video-upload] network error, retrying once:", e.message);
                setProgress(0);
                res = await uploadWithProgress(file, setProgress);
            }
            if (!res.url) {
                throw new Error(res.error || (res.status === 413 ? "File terlalu besar untuk server." : "Upload video gagal."));
            }
            onChange(res.url);
            setUploadedInfo(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
        } catch (e) {
            console.error("[video-upload] failed:", e);
            setError(e instanceof Error ? e.message : "Upload video gagal.");
        } finally {
            setUploading(false);
        }
    }

    return (
        <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-brand-primary" /> Video Produk
                </h3>
                <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">Opsional</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Video singkat meningkatkan kepercayaan pembeli — tunjukkan kondisi asli produk.
                Maks {maxMb} MB &middot; {maxSeconds} detik (MP4/WEBM/MOV).
            </p>

            {videoUrl ? (
                <div className="space-y-3">
                    {uploadedInfo && (
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 shrink-0" /> Video terunggah: {uploadedInfo}
                        </p>
                    )}
                    <video
                        src={videoUrl}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full max-h-72 rounded-xl bg-black"
                    />
                    <button
                        type="button"
                        onClick={() => { onChange(""); setUploadedInfo(""); }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline"
                    >
                        <Trash2 className="w-4 h-4" /> Hapus video
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-4 py-8 flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-brand-primary/50 transition-colors disabled:opacity-60"
                >
                    {uploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
                    <span className="text-sm font-medium">
                        {uploading ? `Mengunggah video... ${progress}%` : "Klik untuk upload video produk"}
                    </span>
                    {uploading ? (
                        <span className="w-full max-w-xs h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <span
                                className="block h-full bg-brand-primary transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </span>
                    ) : (
                        <span className="text-xs text-slate-400">MP4/WEBM/MOV (Maks {maxMb} MB, {maxSeconds} detik)</span>
                    )}
                </button>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                }}
            />
            {error && (
                <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                    {error}
                </p>
            )}
        </section>
    );
}
