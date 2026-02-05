"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { Upload, X, Loader2, FolderPlus } from "lucide-react";
import { uploadAdminFile } from "@/actions/files";
import { useRouter } from "next/navigation";

interface UploadButtonProps {
    folders: string[];
}

export function UploadButton({ folders }: UploadButtonProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [files, setFiles] = useState<File[]>([]);
    const [folder, setFolder] = useState("general");
    const [newFolder, setNewFolder] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files);
        setFiles((prev) => [...prev, ...droppedFiles]);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpload = () => {
        if (files.length === 0) return;

        setError(null);
        const targetFolder = newFolder || folder;

        startTransition(async () => {
            let uploaded = 0;
            for (const file of files) {
                try {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("folder", targetFolder);
                    formData.append("isPublic", String(isPublic));

                    await uploadAdminFile(formData);
                    uploaded++;
                    setProgress(Math.round((uploaded / files.length) * 100));
                } catch (err) {
                    setError(`Gagal upload ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
            }

            setFiles([]);
            setProgress(0);
            setIsOpen(false);
            router.refresh();
        });
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-primary text-white font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
                <Upload className="w-5 h-5" />
                Upload File
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Upload File
                            </h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Drop Zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => fileInputRef.current?.click()}
                                className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    <span className="font-semibold text-brand-primary">Klik untuk pilih</span> atau drag & drop file
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Maksimal 10MB per file
                                </p>
                            </div>

                            {/* Selected Files */}
                            {files.length > 0 && (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {files.map((file, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                    {file.name}
                                                </p>
                                                <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
                                            </div>
                                            <button
                                                onClick={() => removeFile(index)}
                                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Folder Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Folder
                                </label>
                                <select
                                    value={folder}
                                    onChange={(e) => setFolder(e.target.value)}
                                    disabled={!!newFolder}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm disabled:opacity-50"
                                >
                                    <option value="general">General</option>
                                    <option value="products">Products</option>
                                    <option value="banners">Banners</option>
                                    <option value="avatars">Avatars</option>
                                    {folders.filter(f => !["general", "products", "banners", "avatars"].includes(f)).map((f) => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>

                            {/* New Folder */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <FolderPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={newFolder}
                                        onChange={(e) => setNewFolder(e.target.value)}
                                        placeholder="Atau buat folder baru..."
                                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Public Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    File dapat diakses publik (tanpa login)
                                </span>
                            </label>

                            {/* Progress */}
                            {isPending && progress > 0 && (
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                        className="bg-brand-primary h-2 rounded-full transition-all"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={files.length === 0 || isPending}
                                className="flex-1 py-2.5 px-4 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Upload {files.length > 0 && `(${files.length})`}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
