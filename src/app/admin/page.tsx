import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, products, orders, disputes, seller_kyc } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
    ShieldCheck,
    Package,
    Users,
    BarChart3,
    LifeBuoy,
    Gavel,
    ShoppingBag,
    FolderOpen,
    Settings,
    FileImage,
    BadgeCheck,
    Coins,
    Ticket,
    Megaphone,
    ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * /admin landing — earlier this just redirected to /admin/moderation, but
 * server-side redirects from a child page sharing a layout don't always
 * propagate during Next.js 16 client navigation. Render an actual dashboard
 * overview so the right panel always has content.
 */
export default async function AdminDashboardPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/auth/login?callbackUrl=/admin");
    }

    const me = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { id: true, role: true, name: true },
    });
    if (!me || me.role !== "ADMIN") {
        redirect("/");
    }

    const [
        userCount,
        productCount,
        pendingProducts,
        orderCount,
        openDisputes,
        pendingKyc,
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users).then((r) => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` }).from(products).then((r) => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` })
            .from(products)
            .where(eq(products.status, "DRAFT"))
            .then((r) => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` }).from(orders).then((r) => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` })
            .from(disputes)
            .where(sql`${disputes.status} IN ('OPEN', 'IN_PROGRESS', 'AWAITING_RESPONSE')`)
            .then((r) => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` })
            .from(seller_kyc)
            .where(eq(seller_kyc.status, "PENDING_REVIEW"))
            .then((r) => Number(r[0]?.count ?? 0)),
    ]);

    const surfaces: Array<{
        href: string;
        label: string;
        description: string;
        icon: React.ComponentType<{ className?: string }>;
        badge?: number;
    }> = [
            { href: "/admin/moderation", label: "Moderation", description: "Review draft listings", icon: ShieldCheck, badge: pendingProducts },
            { href: "/admin/users", label: "Users", description: "Manage accounts and roles", icon: Users },
            { href: "/admin/categories", label: "Categories", description: "Catalog taxonomy", icon: FolderOpen },
            { href: "/admin/products", label: "Products", description: "All listings", icon: Package },
            { href: "/admin/orders", label: "Orders", description: "Marketplace orders", icon: ShoppingBag },
            { href: "/admin/disputes", label: "Disputes", description: "Buyer/seller cases", icon: Gavel, badge: openDisputes },
            { href: "/admin/kyc", label: "KYC Review", description: "Seller verification", icon: BadgeCheck, badge: pendingKyc },
            { href: "/admin/fees", label: "Fees", description: "Platform fee rules", icon: Coins },
            { href: "/admin/vouchers", label: "Vouchers", description: "Promo codes", icon: Ticket },
            { href: "/admin/affiliates", label: "Affiliates", description: "Affiliate accounts & payout", icon: Megaphone },
            { href: "/admin/files", label: "File Manager", description: "Uploads & assets", icon: FileImage },
            { href: "/admin/analytics", label: "Analytics", description: "Platform metrics", icon: BarChart3 },
            { href: "/admin/support", label: "Support", description: "Tickets and inquiries", icon: LifeBuoy },
            { href: "/admin/settings", label: "Settings", description: "Integrations & feature flags", icon: Settings },
        ];

    return (
        <div className="flex-1 p-8 space-y-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">Admin Panel</p>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                        Dashboard
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Selamat datang, {me.name}.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Users" value={userCount} />
                    <Stat label="Products" value={productCount} />
                    <Stat label="Pending review" value={pendingProducts} highlight={pendingProducts > 0} />
                    <Stat label="Orders" value={orderCount} />
                    <Stat label="Open disputes" value={openDisputes} highlight={openDisputes > 0} />
                    <Stat label="Pending KYC" value={pendingKyc} highlight={pendingKyc > 0} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {surfaces.map((s) => {
                        const Icon = s.icon;
                        return (
                            <Link
                                key={s.href}
                                href={s.href}
                                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-primary hover:shadow-sm transition-all"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-900 group-hover:text-brand-primary transition-colors flex items-center gap-2">
                                            {s.label}
                                            {s.badge !== undefined && s.badge > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-primary text-white">
                                                    {s.badge > 99 ? "99+" : s.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">{s.description}</div>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-primary transition-colors shrink-0" />
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
    return (
        <div className={`rounded-xl border bg-white p-3 ${highlight ? "border-brand-primary" : "border-slate-200"}`}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`text-lg font-bold ${highlight ? "text-brand-primary" : "text-slate-900"}`}>{value}</div>
        </div>
    );
}
