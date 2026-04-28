/**
 * GL-07 — Backfill historical legacy ledger_entries into the new GL.
 *
 * Run via:  npx tsx scripts/backfill-ledger-to-gl.ts [--dry-run] [--since=YYYY-MM-DD] [--limit=1000]
 *
 * Strategy
 * --------
 * Each legacy `entry_group_id` becomes ONE GL journal with a deterministic
 * idempotency key  `BACKFILL:LEDGER:<group_id>`  so re-runs are safe.
 *
 * Mapping (legacy account.type → COA code):
 *   EXTERNAL  ↔ 11300  (Kas di Payment Gateway)
 *   ESCROW    ↔ 23000  (Pendapatan Diterima di Muka / Escrow)
 *   USER_WALLET (owner = seller) ↔ 22000 (Utang ke Seller)  partner_role='SELLER'
 *   USER_WALLET (owner = affiliate-only flow) ↔ 22000 too; partner role inferred
 *     from ref_type ('AFFILIATE_*' → 'AFFILIATE')
 *   PLATFORM  ↔ 41000  (Pendapatan Komisi Marketplace)
 *
 * Source mapping (ref_type → journal source):
 *   ORDER (payment-style)       → AUTO_PAYMENT
 *   ORDER (release-style)       → AUTO_ORDER
 *   ORDER_REFUND                → AUTO_REFUND
 *   PAYOUT*                     → AUTO_PAYOUT
 *   AFFILIATE*                  → AUTO_AFFILIATE
 *   else                        → IMPORT
 *
 * The legacy schema does not distinguish PAYMENT vs RELEASE (both ref_type='ORDER').
 * We disambiguate by line composition: groups with EXTERNAL→ESCROW are payments;
 * groups with ESCROW→USER_WALLET (+ optional PLATFORM) are releases.
 */

import { db } from "../src/db";
import { ledger_accounts, ledger_entries, journals } from "../src/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { postJournal, type JournalSource, type JournalLineInput } from "../src/actions/accounting/journals";

interface CliArgs {
    dryRun: boolean;
    since?: Date;
    limit?: number;
}

function parseArgs(): CliArgs {
    const out: CliArgs = { dryRun: false };
    for (const a of process.argv.slice(2)) {
        if (a === "--dry-run") out.dryRun = true;
        else if (a.startsWith("--since=")) out.since = new Date(a.slice("--since=".length));
        else if (a.startsWith("--limit=")) out.limit = parseInt(a.slice("--limit=".length), 10);
    }
    return out;
}

interface LegacyLine {
    debit: number;
    credit: number;
    accountType: "PLATFORM" | "USER_WALLET" | "ESCROW" | "EXTERNAL";
    ownerUserId: string | null;
    refType: string;
    refId: string;
    memo: string | null;
}

interface LegacyGroup {
    groupId: string;
    createdAt: Date;
    refType: string;
    refId: string;
    lines: LegacyLine[];
}

async function loadGroups(args: CliArgs): Promise<LegacyGroup[]> {
    const conditions = [];
    if (args.since) conditions.push(sql`le.created_at >= ${args.since}`);
    const where = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    const limit = args.limit ? sql`LIMIT ${args.limit}` : sql``;

    const rows = await db.execute<{
        entry_group_id: string;
        created_at: Date;
        debit: string;
        credit: string;
        account_type: "PLATFORM" | "USER_WALLET" | "ESCROW" | "EXTERNAL";
        owner_user_id: string | null;
        ref_type: string;
        ref_id: string;
        memo: string | null;
    }>(sql`
        SELECT le.entry_group_id, le.created_at, le.debit::text as debit, le.credit::text as credit,
               la.type as account_type, la.owner_user_id,
               le.ref_type, le.ref_id, le.memo
        FROM ledger_entries le
        JOIN ledger_accounts la ON la.id = le.account_id
        ${where}
        ORDER BY le.entry_group_id, le.created_at
        ${limit}
    `);

    const map = new Map<string, LegacyGroup>();
    for (const r of rows) {
        let g = map.get(r.entry_group_id);
        if (!g) {
            g = {
                groupId: r.entry_group_id,
                createdAt: r.created_at,
                refType: r.ref_type,
                refId: r.ref_id,
                lines: [],
            };
            map.set(r.entry_group_id, g);
        }
        g.lines.push({
            debit: parseFloat(r.debit),
            credit: parseFloat(r.credit),
            accountType: r.account_type,
            ownerUserId: r.owner_user_id,
            refType: r.ref_type,
            refId: r.ref_id,
            memo: r.memo,
        });
    }
    return Array.from(map.values());
}

function mapAccount(line: LegacyLine): { code: string; partnerRole?: "SELLER" | "AFFILIATE" | "BUYER" } {
    switch (line.accountType) {
        case "EXTERNAL":
            return { code: "11300" };
        case "ESCROW":
            return { code: "23000" };
        case "PLATFORM":
            return { code: "41000" };
        case "USER_WALLET": {
            const role: "SELLER" | "AFFILIATE" =
                line.refType.startsWith("AFFILIATE") ? "AFFILIATE" : "SELLER";
            return { code: "22000", partnerRole: role };
        }
    }
}

function classifyGroup(g: LegacyGroup): { source: JournalSource; description: string } {
    const types = new Set(g.lines.map((l) => l.accountType));
    if (g.refType === "ORDER_REFUND") {
        return { source: "AUTO_REFUND", description: `Backfill: refund order ${g.refId}` };
    }
    if (g.refType.startsWith("PAYOUT")) {
        return { source: "AUTO_PAYOUT", description: `Backfill: payout ${g.refId}` };
    }
    if (g.refType.startsWith("AFFILIATE")) {
        return { source: "AUTO_AFFILIATE", description: `Backfill: affiliate ${g.refType.toLowerCase()} ${g.refId}` };
    }
    if (g.refType === "ORDER") {
        // EXTERNAL→ESCROW = payment; ESCROW→USER_WALLET = release
        if (types.has("EXTERNAL") && types.has("ESCROW") && !types.has("USER_WALLET")) {
            return { source: "AUTO_PAYMENT", description: `Backfill: order payment ${g.refId}` };
        }
        if (types.has("ESCROW") && types.has("USER_WALLET")) {
            return { source: "AUTO_ORDER", description: `Backfill: order release ${g.refId}` };
        }
    }
    return { source: "IMPORT", description: `Backfill: ${g.refType} ${g.refId}` };
}

async function backfill() {
    const args = parseArgs();
    const startedAt = Date.now();

    console.log(`[backfill] dryRun=${args.dryRun}  since=${args.since?.toISOString() ?? "<all>"}  limit=${args.limit ?? "<none>"}`);

    // Sanity: count rows before
    const [{ groupCnt }] = await db.execute<{ groupCnt: string }>(sql`
        SELECT count(DISTINCT entry_group_id)::text as "groupCnt" FROM ledger_entries
    `);
    console.log(`[backfill] legacy groups in DB: ${groupCnt}`);

    const groups = await loadGroups(args);
    console.log(`[backfill] loaded ${groups.length} group(s) for processing`);

    let posted = 0;
    let skipped = 0;
    let failed = 0;
    const failures: Array<{ groupId: string; error: string }> = [];

    for (const g of groups) {
        const idempotencyKey = `BACKFILL:LEDGER:${g.groupId}`;
        const existing = await db.query.journals.findFirst({
            where: eq(journals.idempotency_key, idempotencyKey),
            columns: { id: true },
        });
        if (existing) {
            skipped++;
            continue;
        }

        const { source, description } = classifyGroup(g);
        const lines: JournalLineInput[] = g.lines.map((l) => {
            const m = mapAccount(l);
            return {
                accountCode: m.code,
                debit: l.debit > 0 ? l.debit : undefined,
                credit: l.credit > 0 ? l.credit : undefined,
                memo: l.memo ?? undefined,
                partnerUserId: l.ownerUserId,
                partnerRole: m.partnerRole ?? null,
            };
        });

        if (args.dryRun) {
            console.log(`[backfill] [dry] would post ${source} group=${g.groupId} ref=${g.refType}:${g.refId} lines=${lines.length}`);
            posted++;
            continue;
        }

        try {
            const res = await postJournal({
                book: "PLATFORM",
                source,
                description,
                refType: g.refType,
                refId: g.refId,
                idempotencyKey,
                postedAt: g.createdAt,
                lines,
            });
            posted++;
            if (posted % 50 === 0) console.log(`[backfill] progress: ${posted} posted, ${skipped} skipped`);
            void res;
        } catch (err) {
            failed++;
            failures.push({ groupId: g.groupId, error: err instanceof Error ? err.message : String(err) });
            console.error(`[backfill] FAIL group=${g.groupId}: ${failures[failures.length - 1].error}`);
        }
    }

    const ms = Date.now() - startedAt;
    console.log("");
    console.log(`[backfill] DONE in ${ms}ms`);
    console.log(`  posted:  ${posted}`);
    console.log(`  skipped: ${skipped} (already backfilled)`);
    console.log(`  failed:  ${failed}`);
    if (failures.length > 0) {
        console.log("");
        console.log("First 10 failures:");
        for (const f of failures.slice(0, 10)) console.log(`  ${f.groupId}: ${f.error}`);
    }
}

backfill()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("[backfill] fatal:", err);
        process.exit(1);
    });

// silence unused import warnings (tools may strip on build)
void ledger_accounts;
void ledger_entries;
void and;
