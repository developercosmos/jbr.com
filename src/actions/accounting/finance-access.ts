"use server";

/**
 * GL — Finance access grants (Phase 14 / GL-06).
 *
 * Manage the list of FINANCE_VIEWER users (read-only access to finance reports).
 * Storage: accounting_settings key `finance.viewer_user_ids` (json array of user IDs).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { getSetting, setSetting } from "@/actions/accounting/settings";
import { recordFinanceAudit } from "./audit";

const KEY = "finance.viewer_user_ids";

export interface FinanceViewer {
    id: string;
    name: string | null;
    email: string | null;
}

export async function listFinanceViewers(): Promise<FinanceViewer[]> {
    const ids = (await getSetting<string[]>(KEY, { defaultValue: [] })) ?? [];
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const rows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, ids));
    return rows.map((r) => ({ id: r.id, name: r.name ?? null, email: r.email ?? null }));
}

function back(msg: string): never {
    redirect(`/admin/finance/access?error=${encodeURIComponent(msg)}`);
}

export async function grantFinanceViewerAction(formData: FormData): Promise<void> {
    let session;
    try {
        session = await requireAdminFinanceSession();
    } catch {
        back("Tidak diizinkan.");
    }
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) back("Email wajib diisi.");

    const target = await db.query.users.findFirst({
        where: eq(users.email, email),
        columns: { id: true, email: true },
    });
    if (!target) back(`User dengan email ${email} tidak ditemukan.`);

    const current = ((await getSetting<string[]>(KEY, { defaultValue: [] })) ?? []) as string[];
    if (current.includes(target.id)) back("User sudah memiliki akses viewer.");
    const next = [...current, target.id];

    await setSetting(KEY, next as never, {
        scope: "GLOBAL",
        updatedBy: session.userId,
        notes: `Grant FINANCE_VIEWER to ${email}`,
    });
    await recordFinanceAudit({
        action: "FINANCE_ACCESS_GRANT",
        actorId: session.userId,
        actorEmail: session.email,
        targetType: "user",
        targetId: target.id,
        payload: { email, level: "FINANCE_VIEWER" },
    });
    revalidatePath("/admin/finance/access");
    redirect("/admin/finance/access");
}

export async function revokeFinanceViewerAction(formData: FormData): Promise<void> {
    let session;
    try {
        session = await requireAdminFinanceSession();
    } catch {
        back("Tidak diizinkan.");
    }
    const userId = String(formData.get("user_id") ?? "").trim();
    if (!userId) back("user_id wajib.");

    const current = ((await getSetting<string[]>(KEY, { defaultValue: [] })) ?? []) as string[];
    if (!current.includes(userId)) back("User bukan viewer.");
    const next = current.filter((x) => x !== userId);

    await setSetting(KEY, next as never, {
        scope: "GLOBAL",
        updatedBy: session.userId,
        notes: `Revoke FINANCE_VIEWER from ${userId}`,
    });
    await recordFinanceAudit({
        action: "FINANCE_ACCESS_REVOKE",
        actorId: session.userId,
        actorEmail: session.email,
        targetType: "user",
        targetId: userId,
        payload: { level: "FINANCE_VIEWER" },
    });
    revalidatePath("/admin/finance/access");
    redirect("/admin/finance/access");
}
