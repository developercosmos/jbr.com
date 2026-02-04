import { MessageCircle, Mail, Phone, CheckCircle, Clock, AlertCircle, HelpCircle } from "lucide-react";
import Image from "next/image";
import { getSupportTickets } from "@/actions/admin";
import { TicketActions } from "./TicketActions";
import { TicketFilters } from "./TicketFilters";

// Category config
const CATEGORY_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
    ACCOUNT: {
        label: "Account",
        icon: MessageCircle,
        className: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    },
    PAYMENT: {
        label: "Payment",
        icon: Mail,
        className: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    },
    SHIPPING: {
        label: "Shipping",
        icon: Phone,
        className: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    },
    VERIFICATION: {
        label: "Verification",
        icon: CheckCircle,
        className: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    },
    SECURITY: {
        label: "Security",
        icon: AlertCircle,
        className: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    },
    TECHNICAL: {
        label: "Technical",
        icon: HelpCircle,
        className: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    },
    OTHER: {
        label: "Other",
        icon: HelpCircle,
        className: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    },
};

// Status badge config
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    OPEN: {
        label: "New",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700/50",
    },
    PENDING: {
        label: "Pending",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/50",
    },
    IN_PROGRESS: {
        label: "In Progress",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700/50",
    },
    CLOSED: {
        label: "Closed",
        className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700/50",
    },
};

// Format date
function formatDate(date: Date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes} menit yang lalu`;
    if (hours < 24) return `${hours} jam yang lalu`;
    if (days === 1) return "Kemarin";
    return `${days} hari yang lalu`;
}

interface PageProps {
    searchParams: Promise<{ search?: string; status?: string; category?: string }>;
}

export default async function AdminSupportPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const tickets = await getSupportTickets({
        search: params.search,
        status: params.status,
        category: params.category,
    });

    // Count by status
    const openCount = tickets.filter((t) => t.status === "OPEN").length;
    const pendingCount = tickets.filter((t) => t.status === "PENDING").length;
    const closedCount = tickets.filter((t) => t.status === "CLOSED").length;

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Support Tickets
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Kelola pertanyaan dan bantuan untuk pengguna.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 bg-green-50 dark:bg-green-900/10 text-green-600 rounded-full font-medium text-sm">
                            Open ({openCount})
                        </span>
                        <span className="px-3 py-1 bg-yellow-50 dark:bg-yellow-900/10 text-yellow-600 rounded-full font-medium text-sm">
                            Pending ({pendingCount})
                        </span>
                        <span className="px-3 py-1 bg-slate-50 dark:bg-slate-900/10 text-slate-600 rounded-full font-medium text-sm">
                            Closed ({closedCount})
                        </span>
                    </div>
                </div>

                {/* Filters */}
                <TicketFilters
                    currentSearch={params.search}
                    currentStatus={params.status}
                    currentCategory={params.category}
                />

                {/* Tickets List */}
                <div className="space-y-4">
                    {tickets.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400">
                                {params.search || params.status || params.category
                                    ? "Tidak ada tiket yang sesuai dengan filter"
                                    : "Belum ada tiket support"}
                            </p>
                        </div>
                    ) : (
                        tickets.map((ticket) => {
                            const categoryConfig = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG.OTHER;
                            const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
                            const CategoryIcon = categoryConfig.icon;

                            return (
                                <div
                                    key={ticket.id}
                                    className={`bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${ticket.status === "CLOSED" ? "opacity-75" : ""
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex gap-4">
                                            {/* Category Icon */}
                                            <div
                                                className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${categoryConfig.className}`}
                                            >
                                                <CategoryIcon className="w-5 h-5" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1">
                                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                                                    {ticket.subject}
                                                </h3>
                                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-2 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        {ticket.user.image && (
                                                            <Image
                                                                src={ticket.user.image}
                                                                alt={ticket.user.name}
                                                                width={16}
                                                                height={16}
                                                                className="rounded-full"
                                                            />
                                                        )}
                                                        {ticket.user.name}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{formatDate(ticket.created_at)}</span>
                                                    <span>•</span>
                                                    <span className="text-xs text-slate-400">
                                                        #{ticket.ticket_number}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryConfig.className}`}
                                                >
                                                    {categoryConfig.label}
                                                </span>
                                                {ticket.messages && ticket.messages.length > 0 && (
                                                    <span className="ml-2 text-xs text-slate-500">
                                                        {ticket.messages.length} balasan
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status & Actions */}
                                        <div className="flex flex-col items-end gap-3">
                                            <span
                                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wide ${statusConfig.className}`}
                                            >
                                                {statusConfig.label}
                                            </span>
                                            <TicketActions ticketId={ticket.id} status={ticket.status} />
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
