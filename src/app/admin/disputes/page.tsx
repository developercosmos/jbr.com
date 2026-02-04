import { AlertCircle, MessageSquare, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { getDisputes } from "@/actions/admin";
import { DisputeActions } from "./DisputeActions";
import { DisputeFilters } from "./DisputeFilters";

// Type labels
const TYPE_LABELS: Record<string, string> = {
    ITEM_NOT_AS_DESCRIBED: "Barang Tidak Sesuai",
    ITEM_NOT_RECEIVED: "Barang Tidak Diterima",
    REFUND_REQUEST: "Permintaan Refund",
    SELLER_NOT_RESPONSIVE: "Seller Tidak Responsif",
    OTHER: "Lainnya",
};

// Status badge config
const STATUS_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
    OPEN: {
        label: "Open",
        icon: AlertCircle,
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700/50",
    },
    IN_PROGRESS: {
        label: "Proses",
        icon: MessageSquare,
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/50",
    },
    AWAITING_RESPONSE: {
        label: "Menunggu",
        icon: Clock,
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700/50",
    },
    RESOLVED: {
        label: "Selesai",
        icon: CheckCircle,
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700/50",
    },
    CLOSED: {
        label: "Ditutup",
        icon: XCircle,
        className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700/50",
    },
};

// Priority badge config
const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
    URGENT: { label: "Urgent", className: "bg-red-500 text-white" },
    HIGH: { label: "High", className: "bg-orange-500 text-white" },
    NORMAL: { label: "Normal", className: "bg-blue-500 text-white" },
    LOW: { label: "Low", className: "bg-slate-400 text-white" },
};

// Format currency
function formatCurrency(value: string | null) {
    if (!value) return "-";
    const num = parseFloat(value);
    return `Rp ${num.toLocaleString("id-ID")}`;
}

// Format date
function formatDate(date: Date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return "Baru saja";
    if (hours < 24) return `${hours} jam yang lalu`;
    if (days === 1) return "Kemarin";
    return `${days} hari yang lalu`;
}

interface PageProps {
    searchParams: Promise<{ search?: string; status?: string; priority?: string }>;
}

export default async function AdminDisputesPage({ searchParams }: PageProps) {
    const params = await searchParams;

    let disputes: Awaited<ReturnType<typeof getDisputes>> = [];
    let error: string | null = null;

    try {
        disputes = await getDisputes({
            search: params.search,
            status: params.status,
            priority: params.priority,
        });
    } catch (e) {
        console.error("Failed to fetch disputes:", e);
        error = "Tabel disputes belum tersedia. Silakan jalankan migration: npx drizzle-kit push";
    }

    if (error) {
        return (
            <div className="flex-1 p-8 scroll-smooth">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-2">Database Migration Required</h2>
                        <p className="text-yellow-700 dark:text-yellow-300">{error}</p>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Pusat Resolusi
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Tangani komplain dan sengketa transaksi antara penjual dan pembeli.
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="px-3 py-1 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-full font-medium">
                            {disputes.filter((d) => d.status === "OPEN").length} Open
                        </span>
                        <span className="px-3 py-1 bg-yellow-50 dark:bg-yellow-900/10 text-yellow-600 rounded-full font-medium">
                            {disputes.filter((d) => d.status === "IN_PROGRESS").length} Proses
                        </span>
                    </div>
                </div>

                {/* Filters */}
                <DisputeFilters
                    currentSearch={params.search}
                    currentStatus={params.status}
                    currentPriority={params.priority}
                />

                {/* Disputes List */}
                <div className="space-y-4">
                    {disputes.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400">
                                {params.search || params.status || params.priority
                                    ? "Tidak ada kasus yang sesuai dengan filter"
                                    : "Belum ada kasus sengketa"}
                            </p>
                        </div>
                    ) : (
                        disputes.map((dispute) => {
                            const statusConfig = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.OPEN;
                            const priorityConfig = PRIORITY_CONFIG[dispute.priority] || PRIORITY_CONFIG.NORMAL;
                            const StatusIcon = statusConfig.icon;

                            return (
                                <div
                                    key={dispute.id}
                                    className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="flex-1 space-y-4">
                                            {/* Status and Priority Badges */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wide flex items-center gap-1 ${priorityConfig.className}`}
                                                >
                                                    {priorityConfig.label}
                                                </span>
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wide flex items-center gap-1 ${statusConfig.className}`}
                                                >
                                                    <StatusIcon className="w-3 h-3" />
                                                    {statusConfig.label}
                                                </span>
                                                <span className="text-sm text-slate-500">
                                                    #{dispute.dispute_number}
                                                </span>
                                                <span className="text-sm text-slate-400">•</span>
                                                <span className="text-sm text-slate-500">
                                                    {formatDate(dispute.created_at)}
                                                </span>
                                            </div>

                                            {/* Title and Description */}
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                                    {dispute.title}
                                                </h3>
                                                <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-medium">
                                                    {TYPE_LABELS[dispute.type] || dispute.type}
                                                </span>
                                                {dispute.description && (
                                                    <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2 mt-2">
                                                        {dispute.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Parties */}
                                            <div className="flex items-center gap-6 text-sm flex-wrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500">Pelapor:</span>
                                                    <div className="flex items-center gap-2">
                                                        {dispute.reporter.image && (
                                                            <Image
                                                                src={dispute.reporter.image}
                                                                alt={dispute.reporter.name}
                                                                width={20}
                                                                height={20}
                                                                className="rounded-full"
                                                            />
                                                        )}
                                                        <span className="font-medium text-slate-900 dark:text-white">
                                                            {dispute.reporter.name}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500">Terlapor:</span>
                                                    <div className="flex items-center gap-2">
                                                        {dispute.reported.image && (
                                                            <Image
                                                                src={dispute.reported.image}
                                                                alt={dispute.reported.name || dispute.reported.store_name || ""}
                                                                width={20}
                                                                height={20}
                                                                className="rounded-full"
                                                            />
                                                        )}
                                                        <span className="font-medium text-slate-900 dark:text-white">
                                                            {dispute.reported.store_name || dispute.reported.name}
                                                        </span>
                                                    </div>
                                                </div>
                                                {dispute.amount && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-500">Nilai:</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">
                                                            {formatCurrency(dispute.amount)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Resolution */}
                                            {dispute.resolution && (
                                                <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20">
                                                    <p className="text-sm text-green-800 dark:text-green-300">
                                                        <span className="font-bold">Resolusi:</span> {dispute.resolution}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="min-w-[160px]">
                                            <DisputeActions disputeId={dispute.id} status={dispute.status} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
