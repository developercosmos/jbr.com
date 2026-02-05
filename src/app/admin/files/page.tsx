import { Suspense } from "react";
import Link from "next/link";
import { FileImage, Upload, HardDrive, Image, Video, Music, FileText } from "lucide-react";
import { getAdminFiles, getFileStats, getFileFolders, formatFileSize } from "@/actions/files";
import { FileGrid } from "./FileGrid";
import { FileFilters } from "./FileFilters";
import { UploadButton } from "./UploadButton";

export default async function AdminFilesPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string; type?: string; folder?: string }>;
}) {
    const params = await searchParams;
    const [{ files, total }, stats, folders] = await Promise.all([
        getAdminFiles({
            search: params.search,
            fileType: params.type,
            folder: params.folder,
        }),
        getFileStats(),
        getFileFolders(),
    ]);

    return (
        <>
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white to-transparent pointer-events-none dark:from-white/5 dark:to-transparent"></div>
            <div className="container mx-auto max-w-[1600px] p-6 lg:p-10 flex flex-col gap-8 relative z-0">
                {/* Header */}
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div>
                        <nav aria-label="Breadcrumb" className="flex mb-3">
                            <ol className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                                <li>
                                    <Link href="/admin" className="hover:text-brand-primary transition-colors">
                                        Dashboard
                                    </Link>
                                </li>
                                <li><span className="text-slate-300 dark:text-slate-600">/</span></li>
                                <li><span className="font-medium text-brand-primary">File Manager</span></li>
                            </ol>
                        </nav>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase flex items-center gap-3">
                            <FileImage className="w-8 h-8 text-brand-primary" />
                            File Manager
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg">
                            Kelola semua file asset website: gambar, video, audio, dan dokumen.
                        </p>
                    </div>
                    <UploadButton folders={folders} />
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-brand-primary">
                                <HardDrive className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalFiles}</p>
                                <p className="text-xs text-slate-500">Total Files</p>
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{formatFileSize(stats.totalSize)}</p>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600">
                                <Image className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.byType.image?.count || 0}</p>
                                <p className="text-xs text-slate-500">Images</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600">
                                <Video className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.byType.video?.count || 0}</p>
                                <p className="text-xs text-slate-500">Videos</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600">
                                <Music className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.byType.audio?.count || 0}</p>
                                <p className="text-xs text-slate-500">Audios</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.byType.document?.count || 0}</p>
                                <p className="text-xs text-slate-500">Documents</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <FileFilters folders={folders} />

                {/* Files Grid */}
                <Suspense fallback={<div className="text-center py-12 text-slate-500">Loading files...</div>}>
                    <FileGrid files={files} total={total} />
                </Suspense>
            </div>
        </>
    );
}
