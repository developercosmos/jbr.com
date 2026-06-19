/**
 * Read-only smoke test for the seller-orders query shape (subquery search +
 * groupBy facet counts + status filter + total sort + pagination). Runs the
 * same SQL constructs getSellerOrders uses, for a real seller, to catch runtime
 * SQL errors that type-checking can't.
 *
 *   cd /var/www/jbr && set -a; . .env.local; set +a; npx tsx scripts/smoke-seller-orders.ts
 */
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { eq, and, or, ilike, inArray, desc, sql } from "drizzle-orm";

(async () => {
    const sample = await db.select({ sid: orders.seller_id }).from(orders).limit(1);
    const sellerId = sample[0]?.sid;
    if (!sellerId) {
        console.log("No orders in DB — nothing to smoke.");
        process.exit(0);
    }
    console.log("seller_id:", sellerId);

    const term = "%a%";
    const base = [
        eq(orders.seller_id, sellerId),
        or(
            ilike(orders.order_number, term),
            inArray(orders.buyer_id, db.select({ id: users.id }).from(users).where(ilike(users.name, term)))
        )!,
    ];
    const counts = await db
        .select({ status: orders.status, count: sql<number>`count(*)` })
        .from(orders)
        .where(and(...base))
        .groupBy(orders.status);
    console.log("facet counts (search 'a'):", counts);

    const listConds = [eq(orders.seller_id, sellerId), inArray(orders.status, ["PAID", "PROCESSING"] as const)];
    const list = await db.query.orders.findMany({
        where: and(...listConds),
        orderBy: [desc(orders.total)],
        limit: 20,
        offset: 0,
        with: { buyer: { columns: { id: true, name: true } }, items: { with: { product: true } } },
    });
    console.log("to_ship list rows:", list.length);

    const tot = await db.select({ count: sql<number>`count(*)` }).from(orders).where(and(...listConds));
    console.log("to_ship total:", Number(tot[0]?.count));

    console.log("SMOKE OK");
    process.exit(0);
})().catch((e) => {
    console.error("SMOKE FAIL:", e);
    process.exit(1);
});
