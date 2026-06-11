"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload, Video } from "lucide-react";

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

export default function ProductVideoUpload({ videoUrl, onChange, maxMb, maxSeconds }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    async function handleFile(file: File) {
        setError("");

        if (!file.type.startsWith("video/")) {
            setError("Format harus video (MP4/WEBM/MOV).");
            return;
        }
        if (file.size > maxMb * 1024 * 1024) {
            setError(`Ukuran video maksimal ${maxMb} MB. File Anda: ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
            return;
        }
        try {
            const duration = await readVideoDuration(file);
            if (Number.isFinite(duration) && duration > maxSeconds) {
                setError(`Durasi video maksimal ${maxSeconds} detik. Video Anda: ${Math.round(duration)} detik.`);
                return;
            }
        } catch {
            setError("File video tidak dapat dibaca — coba format MP4.");
            return;
        }

        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("folder", "product-videos");
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.url) {
                throw new Error(json?.error || (res.status === 413 ? "File terlalu besar untuk server." : "Upload video gagal."));
            }
            onChange(json.url);
        } catch (e) {
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
                    <video
                        src={videoUrl}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full max-h-72 rounded-xl bg-black"
                    />
                    <button
                        type="button"
                        onClick={() => onChange("")}
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
                    <span className="text-sm font-medium">{uploading ? "Mengunggah video..." : "Klik untuk upload video produk"}</span>
                    <span className="text-xs text-slate-400">MP4/WEBM/MOV (Maks {maxMb} MB, {maxSeconds} detik)</span>
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
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        </section>
    );
}
