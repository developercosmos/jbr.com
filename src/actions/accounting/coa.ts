"use server";

/**
 * GL — Chart of Accounts (CoA) management (admin-finance only).
 *
 * Lets a finance admin create/edit accounts in coa_accounts. The base chart is
 * seeded by migration 0019; this is for adding org-specific accounts (e.g. a new
 * bank, a new expense line) without a code change.
 *
 * Safety:
 *   - admin-finance gated (requireAdminFinanceSession)
 *   - code is unique (enforced here + by a DB unique index)
 *   - class <-> normal_balance consistency is validated
 *   - an account that already has journal lines cannot be made non-postable or
 *     have its code/class/normal_balance changed (would corrupt posted history);
 *     only name/description/is_active(reactivate) stay editable
 *   - every write is audit-logged
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { coa_accounts, journal_lines } from "@/db/schema-accounting";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { recordFinanceAudit } from "@/actions/accounting/audit";
import { setSetting } from "@/actions/accounting/settings";
import { ACCOUNT_SLOTS } from "@/actions/accounting/account-map-registry";

const ACCOUNT_CLASSES = [
    "ASSET",
    "LIABILITY",
    "EQUITY",
    "REVENUE",
    "CONTRA_REVENUE",
    "COGS",
    "OPEX",
    "OTHER_INCOME",
    "OTHER_EXPENSE",
    "TAX_EXPENSE",
] as const;

const NORMAL_BALANCES = ["DEBIT", "CREDIT"] as const;
const BOOKS = ["PLATFORM", "SELLER"] as const;

// Conventional normal balance per class — used to validate the pairing so an admin
// can't create e.g. a REVENUE account with a DEBIT normal balance by mistake.
const EXPECTED_NORMAL: Record<(typeof ACCOUNT_CLASSES)[number], "DEBIT" | "CREDIT"> = {
    ASSET: "DEBIT",
    LIABILITY: "CREDIT",
    EQUITY: "CREDIT",
    REVENUE: "CREDIT",
    CONTRA_REVENUE: "DEBIT",
    COGS: "DEBIT",
    OPEX: "DEBIT",
    OTHER_INCOME: "CREDIT",
    OTHER_EXPENSE: "DEBIT",
    TAX_EXPENSE: "DEBIT",
};

export interface CoaAccountRow {
    id: string;
    code: string;
    name: string;
    class_: string;
    normalBalance: string;
    isPostable: boolean;
    isActive: boolean;
    book: string;
    description: string | null;
    inUse: boolean; // has journal lines → core fields locked
}

// List ALL accounts (active + inactive) for the management table.
export async function listAllCoaAccounts(): Promise<CoaAccountRow[]> {
    await requireAdminFinanceSession();

    const rows = await db
        .select({
            id: coa_accounts.id,
            code: coa_accounts.code,
            name: coa_accounts.name,
            class_: coa_accounts.class,
            normalBalance: coa_accounts.normal_balance,
            isPostable: coa_accounts.is_postable,
            isActive: coa_accounts.is_active,
            book: coa_accounts.book,
            description: coa_accounts.description,
            usageCount: sql<number>`(select count(*) from ${journal_lines} jl where jl.account_id = ${coa_accounts.id})`,
        })
        .from(coa_accounts)
        .orderBy(asc(coa_accounts.code));

    return rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        class_: String(r.class_),
        normalBalance: String(r.normalBalance),
        isPostable: r.isPostable,
        isActive: r.isActive,
        book: String(r.book),
        description: r.description,
        inUse: Number(r.usageCount) > 0,
    }));
}

const createSchema = z.object({
    code: z
        .string()
        .trim()
        .regex(/^[0-9]{4,10}$/, "Kode akun harus 4–10 digit angka"),
    name: z.string().trim().min(3).max(120),
    class: z.enum(ACCOUNT_CLASSES),
    normal_balance: z.enum(NORMAL_BALANCES),
    book: z.enum(BOOKS).default("PLATFORM"),
    is_postable: z.boolean().default(true),
    description: z.string().trim().max(300).optional(),
});

export async function createCoaAccount(
    input: z.infer<typeof createSchema>
): Promise<{ success: true; id: string } | { success: false; error: string }> {
    const admin = await requireAdminFinanceSession();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
    }
    const v = parsed.data;

    if (EXPECTED_NORMAL[v.class] !== v.normal_balance) {
        return {
            success: false,
            error: `Kelas ${v.class} seharusnya bersaldo normal ${EXPECTED_NORMAL[v.class]}.`,
        };
    }

    const existing = await db.query.coa_accounts.findFirst({
        where: eq(coa_accounts.code, v.code),
        columns: { id: true },
    });
    if (existing) {
        return { success: false, error: `Kode akun ${v.code} sudah dipakai.` };
    }

    const [created] = await db
        .insert(coa_accounts)
        .values({
            code: v.code,
            name: v.name,
            class: v.class,
            normal_balance: v.normal_balance,
            book: v.book,
            is_postable: v.is_postable,
            description: v.description || null,
        })
        .returning({ id: coa_accounts.id });

    await recordFinanceAudit({
        action: "COA_CREATE",
        actorId: admin.userId,
        actorEmail: admin.email,
        targetType: "coa_account",
        targetId: created.id,
        payload: { code: v.code, name: v.name, class: v.class, normal_balance: v.normal_balance },
    });

    revalidatePath("/admin/finance/accounts");
    return { success: true, id: created.id };
}

const updateSchema = z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(300).optional(),
    is_postable: z.boolean(),
    is_active: z.boolean(),
});

export async function updateCoaAccount(
    input: z.infer<typeof updateSchema>
): Promise<{ success: true } | { success: false; error: string }> {
    const admin = await requireAdminFinanceSession();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
    }
    const v = parsed.data;

    const account = await db.query.coa_accounts.findFirst({
        where: eq(coa_accounts.id, v.id),
        columns: { id: true, code: true, is_postable: true },
    });
    if (!account) return { success: false, error: "Akun tidak ditemukan" };

    // If the account already has posted journal lines, refuse to turn OFF postable
    // (it would orphan the ability to balance/adjust historical entries on it).
    if (account.is_postable && !v.is_postable) {
        const [usage] = await db
            .select({ n: sql<number>`count(*)` })
            .from(journal_lines)
            .where(eq(journal_lines.account_id, v.id));
        if (Number(usage?.n ?? 0) > 0) {
            return {
                success: false,
                error: "Akun sudah dipakai di jurnal — tidak boleh dinonaktifkan untuk posting.",
            };
        }
    }

    await db
        .update(coa_accounts)
        .set({
            name: v.name,
            description: v.description || null,
            is_postable: v.is_postable,
            is_active: v.is_active,
            updated_at: new Date(),
        })
        .where(eq(coa_accounts.id, v.id));

    await recordFinanceAudit({
        action: "COA_UPDATE",
        actorId: admin.userId,
        actorEmail: admin.email,
        targetType: "coa_account",
        targetId: v.id,
        payload: { code: account.code, name: v.name, is_postable: v.is_postable, is_active: v.is_active },
    });

    revalidatePath("/admin/finance/accounts");
    return { success: true };
}

// ===========================================================================
// Account mapping override — point a transaction "slot" at a specific account.
// ===========================================================================
const SLOT_KEYS = new Set(ACCOUNT_SLOTS.map((s) => s.slot));

const setMappingSchema = z.object({
    slot: z.string().min(1),
    code: z
        .string()
        .trim()
        .regex(/^[0-9]{4,10}$/, "Kode akun harus 4–10 digit angka"),
});

export async function setAccountMapping(
    input: z.infer<typeof setMappingSchema>
): Promise<{ success: true } | { success: false; error: string }> {
    const admin = await requireAdminFinanceSession();
    const parsed = setMappingSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
    }
    const { slot, code } = parsed.data;

    if (!SLOT_KEYS.has(slot)) {
        return { success: false, error: `Slot transaksi "${slot}" tidak dikenal.` };
    }

    // The target account must exist, be active, and be postable — otherwise a
    // future auto-posting would fail when it resolves to this code.
    const account = await db.query.coa_accounts.findFirst({
        where: eq(coa_accounts.code, code),
        columns: { code: true, is_active: true, is_postable: true },
    });
    if (!account) return { success: false, error: `Akun dengan kode ${code} tidak ada di Chart of Accounts.` };
    if (!account.is_active) return { success: false, error: `Akun ${code} non-aktif.` };
    if (!account.is_postable) return { success: false, error: `Akun ${code} tidak bisa di-posting (is_postable=false).` };

    await setSetting(`gl.account.${slot}`, code, { updatedBy: admin.userId, notes: "account mapping override" });

    await recordFinanceAudit({
        action: "COA_MAPPING_SET",
        actorId: admin.userId,
        actorEmail: admin.email,
        targetType: "account_slot",
        targetId: slot,
        payload: { slot, code },
    });

    revalidatePath("/admin/finance/accounts");
    return { success: true };
}
