/**
 * GL-30 — Isolation hardening for seller finance routes.
 *
 * The single rule: sellerId is ALWAYS derived from the authenticated session.
 * It is never accepted from request params, query strings, or bodies.
 *
 * Use `requireSellerFinanceSession()` at the top of every page/route under
 * /seller/keuangan/* and any export endpoint that returns seller data.
 */
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSellerProfileByUserId } from "@/actions/seller";
import { canAccessSellerCenter } from "@/lib/seller";

export interface SellerFinanceSession {
    userId: string;
    /** sales_register.seller_id is users.id, so this equals userId. */
    sellerId: string;
    storeName: string | null;
}

export async function requireSellerFinanceSession(opts?: {
    redirectTo?: string;
}): Promise<SellerFinanceSession> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect(`/auth/login?redirect=${encodeURIComponent(opts?.redirectTo ?? "/seller/keuangan")}`);
    }
    const profile = await getSellerProfileByUserId(session.user.id);
    if (
        !profile?.store_name ||
        !profile.store_slug ||
        !canAccessSellerCenter(profile.store_status)
    ) {
        redirect("/seller/register");
    }
    return {
        userId: session.user.id,
        sellerId: session.user.id,
        storeName: profile.store_name,
    };
}
