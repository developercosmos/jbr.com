"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/actions/accounting/settings";
import { requireAdminFinanceSession } from "@/lib/admin-finance";

/**
 * Server action to update a single setting from the admin Settings UI.
 * Value is parsed from a string per the declared type:
 *   - "boolean" → "true"/"false"/"1"/"0"
 *   - "number"  → parseFloat
 *   - "string"  → as-is
 *   - "json"    → JSON.parse
 *
 * Errors are returned as { ok: false, error } so the form can display them.
 */
export async function updateAccountingSettingAction(formData: FormData): Promise<{
    ok: boolean;
    error?: string;
}> {
    let session;
    try {
        session = await requireAdminFinanceSession();
    } catch {
        return { ok: false, error: "Tidak diizinkan." };
    }

    const key = String(formData.get("key") ?? "").trim();
    const type = String(formData.get("type") ?? "string");
    const raw = String(formData.get("value") ?? "");
    const effectiveFrom = String(formData.get("effective_from") ?? "");
    const notes = String(formData.get("notes") ?? "");

    if (!key) return { ok: false, error: "Key wajib diisi." };

    let parsed: unknown;
    try {
        if (type === "boolean") {
            const t = raw.toLowerCase();
            if (["true", "1", "yes", "y"].includes(t)) parsed = true;
            else if (["false", "0", "no", "n"].includes(t)) parsed = false;
            else throw new Error("nilai boolean tidak valid (gunakan true/false)");
        } else if (type === "number") {
            const n = parseFloat(raw);
            if (!Number.isFinite(n)) throw new Error("nilai number tidak valid");
            parsed = n;
        } else if (type === "json") {
            parsed = JSON.parse(raw);
        } else {
            parsed = raw;
        }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    try {
        await setSetting(key, parsed as never, {
            scope: "GLOBAL",
            effectiveFrom: effectiveFrom ? new Date(`${effectiveFrom}T00:00:00`) : undefined,
            updatedBy: session.userId,
            notes: notes || undefined,
        });
        try {
            const { recordFinanceAudit } = await import("./audit");
            await recordFinanceAudit({
                action: "SETTING_UPDATE",
                actorId: session.userId,
                actorEmail: session.email,
                targetType: "setting",
                targetId: key,
                payload: { key, type, value: parsed, effectiveFrom: effectiveFrom || null, notes: notes || null },
            });
        } catch {}
        revalidatePath("/admin/finance/settings");
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
