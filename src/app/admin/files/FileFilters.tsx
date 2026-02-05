"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

interface FileFiltersProps {
    folders: string[];
}

export function FileFilters({ folders }: FileFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [showFilters, setShowFilters] = useState(false);

    const currentType = searchParams.get("type") || "all";
    const currentFolder = searchParams.get("folder") || "all";

    const updateParams = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || !value) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.push(`/admin/files?${params.toString()}`);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        updateParams("search", search);
    };

    const fileTypes = [
        { value: "all", label: "Semua" },
        { value: "image", label: "Gambar" },
        { value: "video", label: "Video" },
        { value: "audio", label: "Audio" },
        { value: "document", label: "Dokumen" },
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari file..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
                    />
                </form>

                {/* Toggle Filters */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filter
                </button>

                {/* Quick Type Filters */}
                <div className="flex gap-1">
                    {fileTypes.map((type) => (
                        <button
                            key={type.value}
                            onClick={() => updateParams("type", type.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentType === type.value
                                    ? "bg-brand-primary text-white"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Extended Filters */}
            {showFilters && (
                <div className="flex flex-wrap gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Folder</label>
                        <select
                            value={currentFolder}
                            onChange={(e) => updateParams("folder", e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                        >
                            <option value="all">Semua Folder</option>
                            {folders.map((folder) => (
                                <option key={folder} value={folder}>{folder}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}
