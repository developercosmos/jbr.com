"use server";

/**
 * GL — Inventory admin actions (Phase 12).
 *
 * Server actions called from /admin/finance/inventory UI to:
 *   - create/update inventory_items master records
 *   - record receipts (GR / purchase) → posts journal + audit
 *   - record adjustments (opname / damage) → posts journal + audit
 *
 * All actions are admin-only and write to accounting_audit_log.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import {
    postInventoryReceipt,
    postInventoryAdjustment,
    type InventoryAdjustmentInput,
} from "./inventory-posting";
import { recordFinanceAudit } from "./audit";

type ActionResult = { ok: boolean; error?: string };

function backWithError(path: string, msg: string): never {
    redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

// -------------------------------------------------------------
// Create item
// -------------------------------------------------------------
export async function createInventoryItemAction(formData: FormData): Promise<void> {
    let session;
    try {
        session = await requireAdminFinanceSession();
    } catch {
        backWithError("/admin/finance/inventory/items/new", "Tidak diizinkan.");
    }
    const sku = String(formData.get("sku") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const productId = String(formData.get("product_id") ?? "").trim() || null;
    const costMethodRaw = String(formData.get("cost_method") ?? "MOVING_AVG").trim();
    const costMethod = costMethodRaw === "FIFO" ? "FIFO" : "MOVING_AVG";

    if (!sku) backWithError("/admin/finance/inventory/items/new", "SKU wajib diisi.");
    if (!name) backWithError("/admin/finance/inventory/items/new", "Nama item wajib diisi.");

    let newId: string;
    try {
        const rows = await db.execute(sql`
            INSERT INTO inventory_items (sku, name, product_id, cost_method, is_active)
            VALUES (${sku}, ${name}, ${productId}, ${costMethod}, true)
            RETURNING id
        `);
        const r = (rows as unknown as { id: string }[])[0];
        newId = r.id;
    } catch (err) {
        backWithError("/admin/finance/inventory/items/new", err instanceof Error ? err.message : String(err));
    }

    await recordFinanceAudit({
        action: "INVENTORY_ITEM_CREATE",
        actorId: session.userId,
        actorEmail: session.email,
        targetType: "inventory_item",
        targetId: newId,
        payload: { sku, name, productId, costMethod },
    });

    revalidatePath("/admin/finance/inventory");
    redirect("/admin/finance/inventory");
}

// -------------------------------------------------------------
// Toggle item active
// -------------------------------------------------------------
export async function toggleInventoryItemAction(formData: FormData): Promise<ActionResult> {
    let session;
    try {
        session = await requireAdminFinanceSession();
    } catch {
        return { ok: false, error: "Tidak diizinkan." };
    }
    const itemId = String(formData.get("item_id") ?? "").trim();
    const active = String(formData.get("active") ?? "true") === "true";
    if (!itemId) return { ok: false, error: "item_id wajib." };

    try {
        await db.execute(sql`
            UPDATE inventory_items SET is_active = ${active}, updated_at = now()
            WHERE id = ${itemId}
        `);
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    await recordFinanceAudit({
        action: "INVENTORY_ITEM_TOGGLE",
        actorId: session.userId,
        actorEmail: session.email,
        targetType: "inventory_item",
        targetId: itemId,
        payload: { active },
    });

    revalidatePath("/admin/finance/inventory");
    return { ok: true };
}

// -------------------------------------------------------------
// Record receipt (GR)
// -------------------------------------------------------------
export async function recordReceiptAction(formData: FormData): Promise<void> {
    let session;
    try {
        session = await requireAdminFinanceSession();
    } catch {
        backWithError("/admin/finance/inventory/receipt", "Tidak diizinkan.");
    }
    const itemId = String(formData.get("item_id") ?? "").trim();
    const qty = parseFloat(String(formData.get("qty") ?? "0"));
    const unitCost = parseFloat(String(formData.get("unit_cost") ?? "0"));
    const paymentMode = String(formData.get("payment_mode") ?? "CREDIT") === "CASH" ? "CASH" : "CREDIT";
    const refType = String(formData.get("ref_type") ?? "PURCHASE_ORDER").trim() || "PURCHASE_ORDER";
    const refId = String(formData.get("ref_id") ?? "").trim() || undefined;
    const memo = String(formData.get("memo") ?? "").trim() || undefined;
    const occurredAtRaw = String(formData.get("occurred_at") ?? "").trim();
    const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : undefined;

    if (!itemId) backWithError("/admin/finance/inventory/receipt", "item_id wajib.");
    if (!Number.isFinite(qty) || qty <= 0) backWithError("/admin/finance/inventory/receipt", "qty harus > 0.");
    if (!Number.isFinite(unitCost) || unitCost < 0) backWithError("/admin/finance/inventory/receipt", "unit_cost tidak valid.");

    let journalId: string | null = null;
    try {
        const result = await postInventoryReceipt({
            itemId,
            qty,
            unitCost,
            paymentMode,
            refType,
            refId,
            memo,
            occurredAt,
            createdBy: session.userId,
            idempotencyKey: `RECEIPT:UI:${session.userId}:${Date.now()}`,
        });
        journalId = result.journalId;
    } catch (err) {
        backWithError("/admin/finance/inventory/receipt", err instanceof Error ? err.message : String(err));
    }

    await recordFinanceAudit({
        action: "INVENTORY_RECEIPT",
        actorId: session.userId,
        actorEmail: session.email,
        targetType: "inventory_item",
        targetId: itemId,
        payload: { qty, unitCost, paymentMode, refType, refId, memo, journalId },
    });

    revalidatePath("/admin/finance/inventory");
    redirect("/admin/finance/inventory");
}

// -------------------------------------------------------------
// Record adjustment
// -------------------------------------------------------------
export async function recordAdjustmentAction(formData: FormData): Promise<void> {
    let session;
    try {
        session = await requireAdminFinanceSession();
    } catch {
        backWithError("/admin/finance/inventory/adjustment", "Tidak diizinkan.");
    }
    const itemId = String(formData.get("item_id") ?? "").trim();
    const qtyDelta = parseFloat(String(formData.get("qty_delta") ?? "0"));
    const unitCostRaw = String(formData.get("unit_cost") ?? "").trim();
    const unitCost = unitCostRaw ? parseFloat(unitCostRaw) : undefined;
    const reasonRaw = String(formData.get("reason") ?? "OPNAME_PLUS");
    const allowed: InventoryAdjustmentInput["reason"][] = ["OPNAME_PLUS", "OPNAME_MINUS", "DAMAGE", "WRITE_OFF"];
    const reason = (allowed.includes(reasonRaw as InventoryAdjustmentInput["reason"])
        ? reasonRaw
        : "OPNAME_PLUS") as InventoryAdjustmentInput["reason"];
    const memo = String(formData.get("memo") ?? "").trim() || undefined;
    const occurredAtRaw = String(formData.get("occurred_at") ?? "").trim();
    const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : undefined;

    if (!itemId) backWithError("/admin/finance/inventory/adjustment", "item_id wajib.");
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) backWithError("/admin/finance/inventory/adjustment", "qty_delta harus ≠ 0.");

    let journalId: string | null = null;
    try {
        const result = await postInventoryAdjustment({
            itemId,
            qtyDelta,
            unitCost,
            reason,
            memo,
            occurredAt,
            createdBy: session.userId,
            idempotencyKey: `ADJ:UI:${session.userId}:${Date.now()}`,
        });
        journalId = result.journalId;
    } catch (err) {
        backWithError("/admin/finance/inventory/adjustment", err instanceof Error ? err.message : String(err));
    }

    await recordFinanceAudit({
        action: "INVENTORY_ADJUSTMENT",
        actorId: session.userId,
        actorEmail: session.email,
        targetType: "inventory_item",
        targetId: itemId,
        payload: { qtyDelta, unitCost, reason, memo, journalId },
    });

    revalidatePath("/admin/finance/inventory");
    redirect("/admin/finance/inventory");
}
