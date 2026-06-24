/**
 * Shared parsing for the seller Orders page + CSV export route, so the URL
 * params drive both identically (filter/search/date/sort/pagination).
 */

export type OrderTab = { key: string; label: string; statuses: string[] | null };

// Status lifecycle grouped into actionable buckets for the horizontal tabs.
export const ORDER_TABS: OrderTab[] = [
    { key: "all", label: "Semua", statuses: null },
    { key: "unpaid", label: "Menunggu Pembayaran", statuses: ["PENDING_PAYMENT"] },
    { key: "to_process", label: "Perlu Diproses", statuses: ["PAID"] },
    { key: "packing", label: "Dikemas", statuses: ["PACKING"] },
    { key: "to_ship", label: "Siap Kirim", statuses: ["PROCESSING"] },
    { key: "shipping", label: "Sedang Dikirim", statuses: ["SHIPPED"] },
    { key: "done", label: "Selesai", statuses: ["DELIVERED", "COMPLETED"] },
    { key: "cancelled", label: "Dibatalkan", statuses: ["CANCELLED", "REFUNDED"] },
];

export const DATE_RANGES = [
    { key: "all", label: "Semua Waktu" },
    { key: "today", label: "Hari Ini" },
    { key: "7d", label: "7 Hari Terakhir" },
    { key: "30d", label: "30 Hari Terakhir" },
] as const;

export function resolveDateRange(range?: string): { from?: Date; to?: Date } {
    const now = new Date();
    if (range === "today") {
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        return { from };
    }
    if (range === "7d") return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    if (range === "30d") return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    return {};
}

export type SellerOrderParams = {
    activeKey: string;
    statuses: string[] | undefined;
    q: string;
    range: string;
    from?: Date;
    to?: Date;
    sortBy: "date" | "total" | "order_number";
    sortDir: "asc" | "desc";
    page: number;
};

export function parseSellerOrderParams(sp: Record<string, string | undefined>): SellerOrderParams {
    const activeTab = ORDER_TABS.find((t) => t.key === sp.status) ?? ORDER_TABS[0];
    const range = ["today", "7d", "30d"].includes(sp.range ?? "") ? sp.range! : "all";
    const { from, to } = resolveDateRange(range);
    const sortBy =
        sp.sort === "total" || sp.sort === "order_number" ? sp.sort : "date";
    const sortDir = sp.dir === "asc" ? "asc" : "desc";
    const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
    return {
        activeKey: activeTab.key,
        statuses: activeTab.statuses ?? undefined,
        q: sp.q?.trim() ?? "",
        range,
        from,
        to,
        sortBy,
        sortDir,
        page,
    };
}
