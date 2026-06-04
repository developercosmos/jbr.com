import { listSellerOffers } from "@/actions/offers";
import { getSellerProfileByUserId } from "@/actions/seller";
import { getBuyerReputationSummary } from "@/actions/reputation";
import { canAccessSellerCenter } from "@/lib/seller";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OffersInboxClient from "./OffersInboxClient";

export const dynamic = "force-dynamic";

export default async function SellerOffersPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const profile = await getSellerProfileByUserId(session.user.id);
    if (!profile?.store_name || !profile.store_slug || !canAccessSellerCenter(profile.store_status)) {
        redirect("/seller/register");
    }

    const offers = await listSellerOffers();
    const firstRelation = <T,>(value: T | T[] | null | undefined): T | null =>
        Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

    // DIF-07/PDP-09: fetch buyer reputation band per unique buyer (best-effort —
    // the access-controlled summary can throw on rate limit / no-interaction).
    const uniqueBuyerIds = Array.from(
        new Set(offers.map((o) => firstRelation(o.buyer)?.id).filter((x): x is string => Boolean(x)))
    );
    const bandByBuyer = new Map<string, "LOW" | "MEDIUM" | "HIGH">();
    for (const bid of uniqueBuyerIds) {
        try {
            const rep = await getBuyerReputationSummary(bid);
            if (rep?.band) bandByBuyer.set(bid, rep.band);
        } catch {
            // access denied / rate limited — skip band for this buyer
        }
    }

    const serialized = offers.map((o) => {
        const buyerId = firstRelation(o.buyer)?.id ?? null;
        return {
            id: o.id,
            amount: Number(o.amount),
            status: o.status,
            round: o.round,
            actorRole: o.actor_role,
            expiresAt: o.expires_at.toISOString(),
            createdAt: o.created_at.toISOString(),
            notes: o.notes,
            listing: firstRelation(o.listing),
            buyerId,
            buyerName: firstRelation(o.buyer)?.name ?? null,
            // DIF-13: buyer intent score (0-100). Low score => "Quick offer".
            intentScore: o.intent_score != null ? Number(o.intent_score) : null,
            buyerBand: buyerId ? bandByBuyer.get(buyerId) ?? null : null,
        };
    });

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                        Penawaran Masuk
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Kelola tawaran dari pembeli. Setujui untuk membuka checkout terkunci, atau counter dengan harga
                        baru. Tawaran kadaluarsa otomatis bila tidak dijawab.
                    </p>
                </div>
                <OffersInboxClient offers={serialized} />
            </div>
        </div>
    );
}
