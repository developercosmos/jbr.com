import { listSellerOffers } from "@/actions/offers";
import { getSellerProfileByUserId } from "@/actions/seller";
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

    const serialized = offers.map((o) => ({
        id: o.id,
        amount: Number(o.amount),
        status: o.status,
        round: o.round,
        actorRole: o.actor_role,
        expiresAt: o.expires_at.toISOString(),
        createdAt: o.created_at.toISOString(),
        notes: o.notes,
        listing: o.listing,
        buyerName: o.buyer?.name ?? null,
    }));

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
