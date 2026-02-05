import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { orders, order_items, products } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json({ count: 0 });
        }

        const sellerId = session.user.id;

        // Count orders that need attention (PROCESSING status = need to ship)
        const result = await db
            .select({
                count: sql<number>`COUNT(DISTINCT ${orders.id})`,
            })
            .from(orders)
            .innerJoin(order_items, eq(orders.id, order_items.order_id))
            .innerJoin(products, eq(order_items.product_id, products.id))
            .where(
                and(
                    eq(products.seller_id, sellerId),
                    inArray(orders.status, ["PROCESSING", "PAID"])
                )
            );

        return NextResponse.json({
            count: Number(result[0]?.count || 0),
        });
    } catch (error) {
        console.error("[API] Failed to get pending orders count:", error);
        return NextResponse.json({ count: 0 });
    }
}
