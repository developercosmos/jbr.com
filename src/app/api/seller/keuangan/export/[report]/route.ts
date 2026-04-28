import { NextRequest } from "next/server";
import { requireSellerFinanceSession } from "@/lib/seller-finance";
import { getSellerSalesDetail } from "@/actions/accounting/reports";
import { csvResponse, rowsToCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

function parseDate(s: string | null, endOfDay = false): Date | undefined {
    if (!s) return undefined;
    const iso = endOfDay ? `${s}T23:59:59` : s;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ report: string }> }
) {
    // SECURITY (GL-30): sellerId is derived from session ONLY.
    // Any sellerId/storeId in query string is IGNORED.
    const session = await requireSellerFinanceSession();
    const { report } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const stamp = new Date().toISOString().slice(0, 10);

    if (report === "sales") {
        const from = parseDate(sp.get("from"));
        const to = parseDate(sp.get("to"), true);

        // Stream up to 10k rows in pages of 1000 to keep memory bounded.
        const pageSize = 1000;
        const maxRows = 10000;
        const allRows: (string | number)[][] = [];
        let offset = 0;
        while (allRows.length < maxRows) {
            const page = await getSellerSalesDetail({
                sellerId: session.sellerId,
                from,
                to,
                limit: pageSize,
                offset,
            });
            for (const r of page.rows) {
                allRows.push([
                    r.eventAt,
                    r.event,
                    r.orderId,
                    r.orderItemId,
                    r.sku ?? "",
                    r.qty,
                    r.unitPrice,
                    r.gross,
                    r.discount,
                    r.shipping,
                    r.platformFee,
                    r.sellerNet,
                    r.affiliateCommission,
                    r.saleKind,
                ]);
            }
            if (page.rows.length < pageSize) break;
            offset += pageSize;
        }

        const csv = rowsToCsv(
            [
                "event_at",
                "event",
                "order_id",
                "order_item_id",
                "sku",
                "qty",
                "unit_price",
                "gross",
                "discount",
                "shipping",
                "platform_fee",
                "seller_net",
                "affiliate_commission",
                "sale_kind",
            ],
            allRows
        );
        return csvResponse(`sales_${stamp}.csv`, csv);
    }

    return new Response("unknown report", { status: 404 });
}
