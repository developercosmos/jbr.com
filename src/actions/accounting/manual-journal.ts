"use server";

/**
 * GL — Manual journal entry (admin-only).
 *
 * Posts a balanced journal via the canonical postJournal() entrypoint with
 * source = MANUAL. Used for adjusting entries (akrual, depresiasi, koreksi)
 * that are not driven by an automated event (Xendit webhook, payout, etc.).
 *
 * Form payload (FormData):
 *   description : string (required)
 *   posted_at   : ISO date (optional, default now)
 *   ref_type    : string (optional)
 *   ref_id      : string (optional)
 *   line_count  : N
 *   line[i][account_code]
 *   line[i][debit]   (number, blank means 0)
 *   line[i][credit]  (number, blank means 0)
 *   line[i][memo]    (optional)
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { postJournal, type JournalLineInput } from "@/actions/accounting/journals";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { db } from "@/db";
import { coa_accounts } from "@/db/schema-accounting";
import { and, eq, asc } from "drizzle-orm";

export interface CoaOption {
    code: string;
    name: string;
    class_: string;
    normal_balance: string;
}

/**
 * Read-only loader for the form's account dropdown. Only returns postable +
 * active accounts on the PLATFORM book.
 */
export async function listPostableAccounts(): Promise<CoaOption[]> {
    await requireAdminFinanceSession();
    const rows = await db
        .select({
            code: coa_accounts.code,
            name: coa_accounts.name,
            class_: coa_accounts.class,
            normal_balance: coa_accounts.normal_balance,
        })
        .from(coa_accounts)
        .where(
            and(
                eq(coa_accounts.is_postable, true),
                eq(coa_accounts.is_active, true),
                eq(coa_accounts.book, "PLATFORM")
            )
        )
        .orderBy(asc(coa_accounts.code));
    return rows.map((r) => ({
        code: r.code,
        name: r.name,
        class_: String(r.class_),
        normal_balance: String(r.normal_balance),
    }));
}

function num(v: FormDataEntryValue | null): number {
    if (v === null) return 0;
    const s = String(v).trim().replace(/,/g, "");
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

export async function postManualJournalAction(formData: FormData): Promise<void> {
    const session = await requireAdminFinanceSession();

    const description = String(formData.get("description") ?? "").trim();
    if (!description) throw new Error("Description required");

    const postedAtRaw = String(formData.get("posted_at") ?? "").trim();
    const postedAt = postedAtRaw ? new Date(postedAtRaw) : new Date();
    if (Number.isNaN(postedAt.getTime())) throw new Error("Invalid posted_at");

    const refType = String(formData.get("ref_type") ?? "").trim() || undefined;
    const refId = String(formData.get("ref_id") ?? "").trim() || undefined;

    const lineCount = Math.max(2, Math.min(50, Number(formData.get("line_count") ?? 0)));
    const lines: JournalLineInput[] = [];
    for (let i = 0; i < lineCount; i++) {
        const accountCode = String(formData.get(`line[${i}][account_code]`) ?? "").trim();
        if (!accountCode) continue;
        const debit = num(formData.get(`line[${i}][debit]`));
        const credit = num(formData.get(`line[${i}][credit]`));
        if (debit === 0 && credit === 0) continue;
        const memo = String(formData.get(`line[${i}][memo]`) ?? "").trim() || undefined;
        lines.push({ accountCode, debit, credit, memo });
    }
    if (lines.length < 2) throw new Error("At least 2 non-empty lines required");

    const result = await postJournal({
        book: "PLATFORM",
        source: "MANUAL",
        postedAt,
        description,
        refType,
        refId,
        createdBy: session.userId,
        lines,
    });

    const { recordFinanceAudit } = await import("./audit");
    await recordFinanceAudit({
        action: "JOURNAL_MANUAL_POST",
        actorId: session.userId,
        actorEmail: session.email,
        targetType: "journal",
        targetId: result.journalId,
        payload: { journalNo: result.journalNo, description, postedAt, lineCount: lines.length },
    });

    revalidatePath("/admin/finance/journals");
    redirect(`/admin/finance/journals/new?ok=${encodeURIComponent(result.journalNo)}`);
}
