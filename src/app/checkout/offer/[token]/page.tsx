import Link from "next/link";
import { resolveCheckoutToken } from "@/actions/offers";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { eq } from "drizzle-orm";
import OfferCheckoutClient from "./OfferCheckoutClient";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ token: string }>;
}

export default async function OfferCheckoutPage({ params }: PageProps) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        const { token } = await params;
        redirect(`/auth/login?callbackUrl=/checkout/offer/${token}`);
    }

    const { token } = await params;

    let resolved;
    try {
        resolved = await resolveCheckoutToken(token);
    } catch (err) {
        return (
            <div className="max-w-xl mx-auto p-8">
                <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20 p-5 text-sm text-rose-700 dark:text-rose-200">
                    {err instanceof Error ? err.message : "Token checkout tidak dapat digunakan."}
                </div>
                <Link href="/profile/offers" className="mt-4 inline-block text-sm text-brand-primary hover:underline">
                    ← Kembali ke daftar penawaran
                </Link>
            </div>
        );
    }

    const userAddresses = await db.query.addresses.findMany({
        where: eq(addresses.user_id, session.user.id),
        columns: { id: true, label: true, full_address: true },
    });

    return (
        <div className="max-w-xl mx-auto p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Checkout Tawaran</h1>
                <p className="text-sm text-slate-500">
                    Harga sudah dikunci sesuai penawaran yang disetujui penjual. Selesaikan checkout sebelum waktu habis.
                </p>
            </div>

            <OfferCheckoutClient
                offerId={resolved.offerId}
                token={token}
                amount={resolved.amount}
                listing={{
                    id: resolved.listing.id,
                    title: resolved.listing.title,
                    slug: resolved.listing.slug,
                    listPrice: Number(resolved.listing.price),
                }}
                expiresAt={resolved.expiresAt ? resolved.expiresAt.toISOString() : null}
                addresses={userAddresses}
            />
        </div>
    );
}
