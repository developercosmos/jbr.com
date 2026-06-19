import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSellerOrders, type SellerOrderStatus } from "@/actions/orders";
import { parseSellerOrderParams } from "@/lib/seller-orders-query";
import { rowsToCsv, csvResponse } from "@/lib/csv";

// CSV export of the seller's orders, honoring the same status/search/date/sort
// filters as the Orders page (passed via query string).
export async function GET(req: NextRequest) {
    try {
        const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
        const p = parseSellerOrderParams(sp);

        const { orders } = await getSellerOrders({
            status: p.statuses as SellerOrderStatus[] | undefined,
            q: p.q,
            from: p.from,
            to: p.to,
            sortBy: p.sortBy,
            sortDir: p.sortDir,
            page: 1,
            limit: 1000, // export the current filtered view (capped)
        });

        const headers = ["No. Pesanan", "Tanggal", "Pembeli", "Email", "Status", "Item", "Total"];
        const rows = orders.map((o) => [
            o.order_number,
            o.created_at,
            o.buyer?.name ?? "",
            o.buyer?.email ?? "",
            o.status,
            o.items.map((it) => `${it.product?.title ?? "Produk"} x${it.quantity}`).join("; "),
            o.total,
        ]);

        const stamp = new Date().toISOString().slice(0, 10);
        return csvResponse(`pesanan-${stamp}.csv`, rowsToCsv(headers, rows));
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[API] seller orders export failed:", error);
        return NextResponse.json({ error: "Gagal mengekspor pesanan" }, { status: 500 });
    }
}
