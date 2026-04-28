import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSetting } from "@/actions/accounting/settings";

export interface AdminSession {
    userId: string;
    name: string | null;
    email: string | null;
}

export interface FinanceSession extends AdminSession {
    /** True for ADMIN role; false for FINANCE_VIEWER (read-only). */
    canWrite: boolean;
    role: "ADMIN" | "FINANCE_VIEWER";
}

const VIEWER_SETTING_KEY = "finance.viewer_user_ids";

async function loadViewerIds(): Promise<string[]> {
    try {
        const v = await getSetting<string[]>(VIEWER_SETTING_KEY, { defaultValue: [] });
        return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
        return [];
    }
}

/**
 * Hard guard for admin write surfaces (settings, periods, journals, inventory, etc.).
 * Allows ONLY users with role ADMIN. Redirects everyone else.
 */
export async function requireAdminFinanceSession(): Promise<AdminSession> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login?redirect=/admin/finance");
    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { id: true, name: true, email: true, role: true },
    });
    if (!user || user.role !== "ADMIN") redirect("/");
    return { userId: user.id, name: user.name ?? null, email: user.email ?? null };
}

/**
 * Soft guard for admin read surfaces (Trial Balance, P&L, Balance Sheet, GL, Audit Log,
 * Inventory dashboard, etc.). Allows:
 *   - Users with role ADMIN (full access, canWrite=true)
 *   - Users whose id is listed in accounting_setting "finance.viewer_user_ids"
 *     (FINANCE_VIEWER, canWrite=false)
 *
 * The `canWrite` flag lets pages conditionally hide write buttons.
 */
export async function requireAdminFinanceReader(): Promise<FinanceSession> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login?redirect=/admin/finance");
    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { id: true, name: true, email: true, role: true },
    });
    if (!user) redirect("/");
    if (user.role === "ADMIN") {
        return {
            userId: user.id,
            name: user.name ?? null,
            email: user.email ?? null,
            canWrite: true,
            role: "ADMIN",
        };
    }
    const viewerIds = await loadViewerIds();
    if (!viewerIds.includes(user.id)) {
        redirect("/");
    }
    return {
        userId: user.id,
        name: user.name ?? null,
        email: user.email ?? null,
        canWrite: false,
        role: "FINANCE_VIEWER",
    };
}
