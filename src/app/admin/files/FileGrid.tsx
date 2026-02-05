"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, Video, Music, FileText, File, Trash2, Copy, ExternalLink, Check, Eye, EyeOff } from "lucide-react";
import { deleteAdminFile, updateFileMetadata } from "@/actions/files";
import { formatFileSize } from "@/lib/file-utils";
import { useRouter } from "next/navigation";

interface FileData {
    id: string;
    filename: string;
    original_name: string;
    mime_type: string;
    file_type: "image" | "video" | "audio" | "document" | "other";
    size: number;
    storage_type: "local" | "s3";
    storage_key: string;
    folder: string | null;
    is_public: boolean;
    created_at: Date;
    uploader?: { id: string; name: string | null; email: string } | null;
}

interface FileGridProps {
    files: FileData[];
    total: number;
}

function getFileIcon(type: string) {
    switch (type) {
        case "image": return ImageIcon;
        case "video": return Video;
        case "audio": return Music;
        case "document": return FileText;
        default: return File;
    }
}

function getFileIconColor(type: string) {
    switch (type) {
        case "image": return "text-green-600 bg-green-50 dark:bg-green-500/10";
        case "video": return "text-purple-600 bg-purple-50 dark:bg-purple-500/10";
        case "audio": return "text-orange-600 bg-orange-50 dark:bg-orange-500/10";
        case "document": return "text-red-600 bg-red-50 dark:bg-red-500/10";
        default: return "text-slate-600 bg-slate-50 dark:bg-slate-500/10";
    }
}

export function FileGrid({ files, total }: FileGridProps) {
    const router = useRouter();
    const [deleting, setDeleting] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const handleDelete = async (fileId: string) => {
        if (!confirm("Hapus file ini?")) return;
        setDeleting(fileId);
        try {
            await deleteAdminFile(fileId);
            router.refresh();
        } catch (error) {
            alert("Gagal menghapus file");
        } finally {
            setDeleting(null);
        }
    };

    const handleCopyUrl = (fileId: string) => {
        const url = `${window.location.origin}/api/files/${fileId}`;
        navigator.clipboard.writeText(url);
        setCopied(fileId);
        setTimeout(() => setCopied(null), 2000);
    };

    const togglePublic = async (file: FileData) => {
        try {
            await updateFileMetadata(file.id, { is_public: !file.is_public });
            router.refresh();
        } catch {
            alert("Gagal mengubah visibility");
        }
    };

    if (files.length === 0) {
        return (
            <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800">
                <File className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Belum ada file</h3>
                <p className="text-slate-500">Upload file pertama Anda menggunakan tombol di atas.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">{total} file ditemukan</p>

            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {files.map((file) => {
                    const Icon = getFileIcon(file.file_type);
                    const iconColor = getFileIconColor(file.file_type);
                    const isImage = file.file_type === "image";
                    const proxyUrl = `/api/files/${file.id}`;

                    return (
                        <div
                            key={file.id}
                            className="group relative bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:border-brand-primary/50 transition-all"
                        >
                            {/* Preview Area */}
                            <div className="aspect-square relative bg-slate-100 dark:bg-slate-800">
                                {isImage ? (
                                    <Image
                                        src={proxyUrl}
                                        alt={file.original_name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div className={`p-4 rounded-full ${iconColor}`}>
                                            <Icon className="w-8 h-8" />
                                        </div>
                                    </div>
                                )}

                                {/* Public/Private Badge */}
                                <div className="absolute top-2 left-2">
                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${file.is_public
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                        }`}>
                                        {file.is_public ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                        {file.is_public ? "Public" : "Private"}
                                    </span>
                                </div>

                                {/* Hover Actions */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => handleCopyUrl(file.id)}
                                        className="p-2 rounded-lg bg-white/90 text-slate-900 hover:bg-white transition-colors"
                                        title="Copy URL"
                                    >
                                        {copied === file.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                    <a
                                        href={proxyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-lg bg-white/90 text-slate-900 hover:bg-white transition-colors"
                                        title="Open in new tab"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                    <button
                                        onClick={() => togglePublic(file)}
                                        className="p-2 rounded-lg bg-white/90 text-slate-900 hover:bg-white transition-colors"
                                        title={file.is_public ? "Make Private" : "Make Public"}
                                    >
                                        {file.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(file.id)}
                                        disabled={deleting === file.id}
                                        className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* File Info */}
                            <div className="p-3">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate" title={file.original_name}>
                                    {file.original_name}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {formatFileSize(file.size)} • {file.folder}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
