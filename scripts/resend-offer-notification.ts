/**
 * One-off maintenance: re-send the "Penawaran baru" (OFFER_RECEIVED) email to a
 * seller. Built for the case where an earlier email carried the WRONG deep-link
 * (pre-fix it pointed at /profile/offers instead of /seller/offers?offer=<id>).
 *
 * Reuses the real notify() pipeline, so the email is identical to production —
 * correct transport (Resend/sendmail), template, opt-out handling — and uses the
 * now-fixed CTA. A fresh idempotencyKey bypasses notify()'s dedup so the resend
 * actually fires (the original notification row is left untouched).
 *
 *   cd /var/www/jbr
 *   set -a; . .env.local; set +a
 *   npx tsx scripts/resend-offer-notification.ts                 # DRY RUN, seller~"ametis"
 *   npx tsx scripts/resend-offer-notification.ts --seller=ametis # DRY RUN, custom match
 *   npx tsx scripts/resend-offer-notification.ts --offer=<uuid>  # DRY RUN, one offer
 *   npx tsx scripts/resend-offer-notification.ts --execute       # actually send
 *
 * Safe to re-run: each --execute uses a unique idempotency key, so it never
 * collides with the original notification, but DRY RUN is the default.
 */
import { db } from "@/db";
import { offers, products, users } from "@/db/schema";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/format";

function arg(name: string): string | null {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split("=").slice(1).join("=") : null;
}

const EXECUTE = process.argv.includes("--execute");
const SELLER_MATCH = arg("seller") || "ametis";
const OFFER_ID = arg("offer");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jualbeliraket.com";
const runStamp = Date.now();

async function main() {
    // 1) Resolve the target offers.
    //    A seller is notified (OFFER_RECEIVED) when a buyer has the latest move on
    //    a PENDING offer — i.e. it's the seller's turn to respond. That's exactly
    //    the email whose link was wrong.
    let targetSellerIds: string[] | null = null;
    if (!OFFER_ID) {
        const sellers = await db
            .select({ id: users.id, name: users.name, email: users.email, store: users.store_name })
            .from(users)
            .where(
                or(
                    ilike(users.name, `%${SELLER_MATCH}%`),
                    ilike(users.store_name, `%${SELLER_MATCH}%`),
                    ilike(users.email, `%${SELLER_MATCH}%`)
                )
            );
        console.log(`Penjual cocok "${SELLER_MATCH}": ${sellers.length}`);
        for (const s of sellers) {
            console.log(`  - ${s.name}  toko="${s.store || "-"}"  <${s.email}>  id=${s.id}`);
        }
        if (sellers.length === 0) {
            console.log("Tidak ada penjual cocok. Gunakan --seller=<substr> atau --offer=<uuid>.");
            return;
        }
        if (sellers.length > 1 && EXECUTE && !OFFER_ID) {
            console.log("\n>1 penjual cocok — untuk --execute, persempit --seller= atau pakai --offer=<uuid>.");
            return;
        }
        targetSellerIds = sellers.map((s) => s.id);
    }

    const baseWhere = OFFER_ID
        ? eq(offers.id, OFFER_ID)
        : and(
              eq(offers.status, "PENDING"),
              eq(offers.actor_role, "buyer"),
              // seller_id in targetSellerIds (small set) — OR them
              or(...targetSellerIds!.map((id) => eq(offers.seller_id, id)))
          );

    const rows = await db
        .select({
            offerId: offers.id,
            sellerId: offers.seller_id,
            buyerId: offers.buyer_id,
            listingId: offers.listing_id,
            amount: offers.amount,
            round: offers.round,
            status: offers.status,
            actorRole: offers.actor_role,
            createdAt: offers.created_at,
        })
        .from(offers)
        .where(baseWhere)
        .orderBy(desc(offers.created_at));

    if (rows.length === 0) {
        console.log("\nTidak ada penawaran PENDING menunggu respon penjual untuk kriteria ini.");
        return;
    }

    console.log(`\nPenawaran target: ${rows.length}${EXECUTE ? "  (MODE: EXECUTE — akan kirim)" : "  (MODE: DRY RUN)"}\n`);

    let sent = 0;
    for (const r of rows) {
        const [product, buyer, seller] = await Promise.all([
            db.query.products.findFirst({ where: eq(products.id, r.listingId), columns: { title: true } }),
            db.query.users.findFirst({ where: eq(users.id, r.buyerId), columns: { name: true } }),
            db.query.users.findFirst({ where: eq(users.id, r.sellerId), columns: { name: true, email: true } }),
        ]);
        const productTitle = product?.title ?? "(produk)";
        const buyerName = buyer?.name || "Pembeli";
        const cta = `${APP_URL}/seller/offers?offer=${r.offerId}`;

        console.log(`• Offer ${r.offerId}`);
        console.log(`    Penjual : ${seller?.name} <${seller?.email}>  (id=${r.sellerId})`);
        console.log(`    Produk  : ${productTitle}`);
        console.log(`    Penawar : ${buyerName}  |  Nilai: ${formatCurrency(Number(r.amount))}  |  Ronde: ${r.round}  |  Status: ${r.status}/${r.actorRole}`);
        console.log(`    Link    : ${cta}`);

        if (EXECUTE) {
            const res = await notify({
                event: "OFFER_RECEIVED",
                audience: "seller",
                recipientUserId: r.sellerId,
                offerId: r.offerId,
                productTitle,
                amount: formatCurrency(Number(r.amount)),
                actorName: buyerName,
                round: r.round,
                // Fresh key so this resend never dedups against the original notification.
                idempotencyKey: `OFFER_RECEIVED:${r.offerId}:${r.sellerId}:resend:${runStamp}`,
            });
            console.log(`    -> notify: ${res.duplicate ? "DUPLICATE (tidak terkirim)" : "dikirim (cek opt-out kategori 'offers')"}`);
            sent++;
        }
        console.log("");
    }

    if (!EXECUTE) {
        console.log("DRY RUN selesai. Tambah --execute untuk benar-benar mengirim ulang.");
    } else {
        console.log(`Selesai. ${sent} notifikasi diproses (email terkirim bila penjual tidak opt-out kategori 'offers').`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("GAGAL:", err);
        process.exit(1);
    });
