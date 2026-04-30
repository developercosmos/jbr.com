import Link from "next/link";
import { Tag } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listBuyerOffers } from "@/actions/offers";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { BuyerOffersClient } from "./BuyerOffersClient";

export const dynamic = "force-dynamic";

export default async function BuyerOffersPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const offers = await listBuyerOffers();
    const expiryWarningEnabled = await isFeatureEnabled("dif.offer_expiry_warning", {
        userId: session?.user?.id,
        bucketKey: session?.user?.id,
    });

    // Group offers by root_offer_id so each negotiation thread shows as one row
    // with rounds nested. Latest round first inside each thread.
    const threadMap = new Map<string, typeof offers>();
    for (const offer of offers) {
        const key = offer.root_offer_id || offer.id;
        const list = threadMap.get(key) ?? [];
        list.push(offer);
        threadMap.set(key, list);
    }
    const threads = Array.from(threadMap.values()).map((rounds) =>
        rounds
            .slice()
            .sort((a, b) => (b.round ?? 0) - (a.round ?? 0))
    );
    threads.sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime());

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Tag className="w-6 h-6 text-amber-600" />
                    Tawaran Saya
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Lihat status semua tawaran yang pernah Anda kirim ke penjual.
                </p>
            </div>

            {threads.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                    <p>Belum ada tawaran. Saat Anda menawar produk, riwayatnya muncul di sini.</p>
                    <Link
                        href="/search"
                        className="inline-block mt-4 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm hover:bg-brand-primary/90"
                    >
                        Cari Produk
                    </Link>
                </div>
            ) : (
                <BuyerOffersClient threads={threads} expiryWarningEnabled={expiryWarningEnabled} />
            )}
        </div>
    );
}
