"use server";

/**
 * GL — 1P Inventory + COGS posting helpers (Phase 8).
 *
 * Provides:
 *   - postInventoryReceipt(): DR 13100 / CR 21100 (atau 11100/Kas jika tunai)
 *   - postInventoryAdjustment(): DR/CR 13100 vs 51100 atau 69000 (loss)
 *   - postCogsOnSale(): DR 51100 / CR 13100 menggunakan moving-average cost
 *   - recomputeItemAggregates(): refresh cache on_hand_qty/avg/value
 *
 * Cost method: MOVING_AVG default. FIFO direncanakan tapi belum diimplementasi;
 * input dengan cost_method=FIFO akan ditolak dengan error eksplisit hingga
 * lot-tracking ditambahkan.
 *
 * SECURITY: server-only (use server). Caller wajib admin (route guard).
 *
 * NOTE: Tabel inventory_items / inventory_movements baru dibuat oleh
 * migrasi 0020_inventory_cogs.sql. Hingga migrasi diaplikasikan ke environment
 * target, helper ini akan throw runtime error — UI scaffold mendeteksi dengan
 * try/catch dan menampilkan instruksi migrasi.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { postJournal, type PostJournalResult } from "./journals";

export interface InventoryReceiptInput {
    itemId: string;
    qty: number;          // positive
    unitCost: number;     // positive (IDR)
    paymentMode: "CREDIT" | "CASH"; // CREDIT → 21100, CASH → 11100
    refType?: string;     // e.g. 'PURCHASE_ORDER'
    refId?: string;
    memo?: string;
    occurredAt?: Date;
    createdBy?: string;
    idempotencyKey?: string;
}

export interface CogsOnSaleInput {
    itemId: string;
    qty: number;          // positive — quantity issued
    refType?: string;     // e.g. 'ORDER_ITEM'
    refId?: string;
    memo?: string;
    occurredAt?: Date;
    createdBy?: string;
    idempotencyKey?: string;
}

export interface InventoryAdjustmentInput {
    itemId: string;
    qtyDelta: number;     // signed — positive = add, negative = remove
    unitCost?: number;    // for additions; defaults to current avg
    reason: "OPNAME_PLUS" | "OPNAME_MINUS" | "DAMAGE" | "WRITE_OFF";
    refType?: string;
    refId?: string;
    memo?: string;
    occurredAt?: Date;
    createdBy?: string;
    idempotencyKey?: string;
}

interface ItemRow {
    id: string;
    cost_method: "MOVING_AVG" | "FIFO";
    on_hand_qty: string;
    avg_unit_cost: string;
    on_hand_value: string;
}

async function loadItem(itemId: string): Promise<ItemRow> {
    const rows = await db.execute(sql`
        SELECT id, cost_method, on_hand_qty::text, avg_unit_cost::text, on_hand_value::text
        FROM inventory_items WHERE id = ${itemId} LIMIT 1
    `);
    const r = (rows as unknown as ItemRow[])[0];
    if (!r) throw new Error(`inventory_items not found: ${itemId}`);
    if (r.cost_method === "FIFO") {
        throw new Error("FIFO cost method not yet implemented (Phase 8 scaffolds MOVING_AVG only)");
    }
    return r;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}

/** Atomically write an inventory_movements row + refresh aggregate cache. */
async function recordMovement(args: {
    itemId: string;
    kind: "RECEIPT" | "ADJUSTMENT" | "ISSUE" | "RETURN_IN" | "RETURN_OUT";
    qty: number;        // signed
    unitCost: number;
    journalId: string | null;
    refType?: string;
    refId?: string;
    memo?: string;
    occurredAt?: Date;
    createdBy?: string;
}): Promise<void> {
    const totalCost = round2(args.qty * args.unitCost);
    await db.execute(sql`
        INSERT INTO inventory_movements
            (item_id, kind, qty, unit_cost, total_cost,
             ref_type, ref_id, journal_id, memo, created_by, occurred_at)
        VALUES
            (${args.itemId}, ${args.kind}, ${args.qty}, ${args.unitCost}, ${totalCost},
             ${args.refType ?? null}, ${args.refId ?? null}, ${args.journalId},
             ${args.memo ?? null}, ${args.createdBy ?? null},
             ${args.occurredAt ? args.occurredAt.toISOString() : sql`now()`})
    `);
}

async function recomputeAggregates(itemId: string): Promise<void> {
    // moving-average: aggregates derived sequentially from movements.
    // For simplicity (and to keep Phase 8 scoped), recompute from scratch
    // each call. Performance-bound by per-item movement count which is small.
    const movs = await db.execute(sql`
        SELECT kind, qty::text, unit_cost::text
        FROM inventory_movements WHERE item_id = ${itemId}
        ORDER BY occurred_at, id
    `);
    type M = { kind: string; qty: string; unit_cost: string };
    let qtyOnHand = 0;
    let valueOnHand = 0;
    for (const m of movs as unknown as M[]) {
        const q = Number(m.qty);
        const uc = Number(m.unit_cost);
        if (q > 0) {
            // additions update average
            const newQty = qtyOnHand + q;
            const newValue = valueOnHand + q * uc;
            qtyOnHand = newQty;
            valueOnHand = newValue;
        } else if (q < 0) {
            // issue at current avg
            const avg = qtyOnHand > 0 ? valueOnHand / qtyOnHand : 0;
            qtyOnHand = qtyOnHand + q; // q negative
            valueOnHand = valueOnHand + q * avg;
            if (qtyOnHand < 0) qtyOnHand = 0;
            if (valueOnHand < 0) valueOnHand = 0;
        }
    }
    const avg = qtyOnHand > 0 ? valueOnHand / qtyOnHand : 0;
    await db.execute(sql`
        UPDATE inventory_items
        SET on_hand_qty   = ${round4(qtyOnHand)},
            avg_unit_cost = ${round4(avg)},
            on_hand_value = ${round2(valueOnHand)},
            updated_at    = now()
        WHERE id = ${itemId}
    `);
}

// ----------------------------------------------------------------
// Public posting helpers
// ----------------------------------------------------------------

export async function postInventoryReceipt(
    input: InventoryReceiptInput
): Promise<PostJournalResult> {
    if (input.qty <= 0) throw new Error("qty must be positive");
    if (input.unitCost < 0) throw new Error("unitCost must be >= 0");
    const item = await loadItem(input.itemId);
    const total = round2(input.qty * input.unitCost);
    const credAccount = input.paymentMode === "CASH" ? "11100" : "21100";

    const result = await postJournal({
        source: "IMPORT",
        description: `1P Receipt — item ${item.id} qty ${input.qty} @ ${input.unitCost}`,
        refType: input.refType ?? "INVENTORY_RECEIPT",
        refId: input.refId ?? input.itemId,
        idempotencyKey: input.idempotencyKey,
        postedAt: input.occurredAt,
        createdBy: input.createdBy,
        lines: [
            { accountCode: "13100", debit: total, memo: input.memo ?? "Inventory receipt" },
            { accountCode: credAccount, credit: total, memo: input.memo ?? "Inventory receipt" },
        ],
    });

    await recordMovement({
        itemId: input.itemId,
        kind: "RECEIPT",
        qty: input.qty,
        unitCost: input.unitCost,
        journalId: result.journalId,
        refType: input.refType,
        refId: input.refId,
        memo: input.memo,
        occurredAt: input.occurredAt,
        createdBy: input.createdBy,
    });
    await recomputeAggregates(input.itemId);
    return result;
}

export async function postCogsOnSale(input: CogsOnSaleInput): Promise<PostJournalResult> {
    if (input.qty <= 0) throw new Error("qty must be positive");
    const item = await loadItem(input.itemId);
    const onHand = Number(item.on_hand_qty);
    if (input.qty > onHand) {
        throw new Error(`Insufficient stock for item ${item.id}: requested ${input.qty}, on_hand ${onHand}`);
    }
    const avg = Number(item.avg_unit_cost);
    const total = round2(input.qty * avg);

    const result = await postJournal({
        source: "AUTO_ORDER",
        description: `1P COGS — item ${item.id} qty ${input.qty} @ avg ${avg}`,
        refType: input.refType ?? "INVENTORY_ISSUE",
        refId: input.refId ?? input.itemId,
        idempotencyKey: input.idempotencyKey,
        postedAt: input.occurredAt,
        createdBy: input.createdBy,
        lines: [
            { accountCode: "51100", debit: total, memo: input.memo ?? "COGS on sale" },
            { accountCode: "13100", credit: total, memo: input.memo ?? "COGS on sale" },
        ],
    });

    await recordMovement({
        itemId: input.itemId,
        kind: "ISSUE",
        qty: -input.qty, // signed negative
        unitCost: avg,
        journalId: result.journalId,
        refType: input.refType,
        refId: input.refId,
        memo: input.memo,
        occurredAt: input.occurredAt,
        createdBy: input.createdBy,
    });
    await recomputeAggregates(input.itemId);
    return result;
}

export async function postInventoryAdjustment(
    input: InventoryAdjustmentInput
): Promise<PostJournalResult> {
    if (input.qtyDelta === 0) throw new Error("qtyDelta must be nonzero");
    const item = await loadItem(input.itemId);
    const isPositive = input.qtyDelta > 0;
    const unitCost = isPositive
        ? (input.unitCost ?? Number(item.avg_unit_cost))
        : Number(item.avg_unit_cost);
    if (unitCost < 0) throw new Error("unitCost must be >= 0");
    const total = round2(Math.abs(input.qtyDelta) * unitCost);

    // Loss / opname-minus → DR 69000 (Beban Lain-lain) / CR 13100
    // Opname-plus / found → DR 13100 / CR 49000? we use 32000 (saldo laba) too aggressive.
    //   Use 69000 reversal (DR negative) — simpler: DR 13100 / CR 69000 (mengurangi beban).
    const lines = isPositive
        ? [
              { accountCode: "13100", debit: total, memo: input.memo ?? `Adj ${input.reason}` },
              { accountCode: "69000", credit: total, memo: input.memo ?? `Adj ${input.reason}` },
          ]
        : [
              { accountCode: "69000", debit: total, memo: input.memo ?? `Adj ${input.reason}` },
              { accountCode: "13100", credit: total, memo: input.memo ?? `Adj ${input.reason}` },
          ];

    const result = await postJournal({
        source: "AUTO_ADJUST_PERIOD",
        description: `1P Inventory Adj (${input.reason}) — item ${item.id} qty ${input.qtyDelta}`,
        refType: input.refType ?? "INVENTORY_ADJUST",
        refId: input.refId ?? input.itemId,
        idempotencyKey: input.idempotencyKey,
        postedAt: input.occurredAt,
        createdBy: input.createdBy,
        lines,
    });

    await recordMovement({
        itemId: input.itemId,
        kind: "ADJUSTMENT",
        qty: input.qtyDelta,
        unitCost,
        journalId: result.journalId,
        refType: input.refType,
        refId: input.refId,
        memo: input.memo,
        occurredAt: input.occurredAt,
        createdBy: input.createdBy,
    });
    await recomputeAggregates(input.itemId);
    return result;
}

// ----------------------------------------------------------------
// Helpers exported for tests / scripts (pure)
// ----------------------------------------------------------------

export interface MovingAvgState {
    qtyOnHand: number;
    valueOnHand: number;
}

/** Pure simulation of moving-average update for a sequence of movements.
 *  Used by unit tests to verify cost math without DB. */
export function simulateMovingAverage(
    movements: Array<{ qty: number; unitCost: number }>
): MovingAvgState & { avg: number } {
    let qty = 0;
    let value = 0;
    for (const m of movements) {
        if (m.qty > 0) {
            qty += m.qty;
            value += m.qty * m.unitCost;
        } else if (m.qty < 0) {
            const avg = qty > 0 ? value / qty : 0;
            qty += m.qty;
            value += m.qty * avg;
            if (qty < 0) qty = 0;
            if (value < 0) value = 0;
        }
    }
    return {
        qtyOnHand: round4(qty),
        valueOnHand: round2(value),
        avg: qty > 0 ? round4(value / qty) : 0,
    };
}
