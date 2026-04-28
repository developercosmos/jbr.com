import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orders, wishlists, users } from "@/db/schema";
import { eq, and, sql, ne } from "drizzle-orm";
import { MapPin, Package2, Heart, Settings, Trophy, Megaphone, Bell, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * /profile is the landing page for the profile section. Earlier this just
 * redirected to /profile/address, but server-side redirect from a child page
 * inside a shared layout does not always propagate during Next.js 16 client
 * navigation — the URL stays at /profile and the right panel renders empty.
 *
 * Render a real overview here so the panel always has content regardless of
 * the navigation path used to arrive.
 */
export default async function ProfilePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/auth/login?callbackUrl=/profile");
    }

    const userId = session.user.id;

    const [stats, profile] = await Promise.all([
        Promise.all([
            db.select({ count: sql<number>`count(*)` })
                .from(orders)
                .where(and(eq(orders.buyer_id, userId), ne(orders.status, "CANCELLED"))),
            db.select({ count: sql<number>`count(*)` })
                .from(wishlists)
                .where(eq(wishlists.user_id, userId)),
        ]),
        db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { name: true, email: true, phone: true, locale: true, tier: true },
        }),
    ]);

    const orderCount = Number(stats[0][0]?.count ?? 0);
    const wishlistCount = Number(stats[1][0]?.count ?? 0);

    const links: Array<{ href: string; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
        { href: "/profile/address", label: "Daftar Alamat", description: "Kelola alamat pengiriman dan pickup", icon: MapPin },
        { href: "/profile/orders", label: "Pesanan Saya", description: `${orderCount} pesanan aktif & riwayat`, icon: Package2 },
        { href: "/profile/wishlist", label: "Wishlist", description: `${wishlistCount} produk disimpan`, icon: Heart },
        { href: "/profile/notifications", label: "Notifikasi", description: "Update pesanan, promo, dan dispute", icon: Bell },
        { href: "/profile/player", label: "Profil Pemain", description: "Untuk rekomendasi raket sesuai gaya", icon: Trophy },
        { href: "/affiliate", label: "Afiliasi", description: "Code referral dan dashboard komisi", icon: Megaphone },
        { href: "/profile/settings", label: "Pengaturan Akun", description: "Nama, kontak, lokal, dan privasi", icon: Settings },
    ];

    return (
        <div className="space-y-8">
            <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Akun Saya</p>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                    Halo, {profile?.name || session.user.name || "User"}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {profile?.email ?? session.user.email}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Tier" value={profile?.tier ?? "T0"} />
                <Stat label="Pesanan" value={String(orderCount)} />
                <Stat label="Wishlist" value={String(wishlistCount)} />
                <Stat label="Bahasa" value={profile?.locale ?? "id-ID"} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {links.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-primary hover:shadow-sm transition-all"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-900 group-hover:text-brand-primary transition-colors">
                                        {item.label}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                        {item.description}
                                    </div>
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-primary transition-colors shrink-0" />
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-lg font-bold text-slate-900">{value}</div>
        </div>
    );
}
