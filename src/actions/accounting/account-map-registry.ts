/**
 * GL — Account mapping registry (PURE data; safe to import from client & server).
 *
 * This module intentionally has NO "use server" directive and NO server-only
 * imports, so it can be imported by:
 *   - server actions (account-map.ts, coa.ts) — for resolution & validation
 *   - client components (AccountMappingManager.tsx) — for the AccountSlotState type
 *
 * A "use server" file may only export async functions, so the slot registry
 * (a plain const) and its types must live here, not in account-map.ts.
 */

export interface AccountSlot {
    slot: string;
    label: string;
    group: string;
    defaultCode: string;
    note?: string;
}

// The canonical registry. defaultCode MUST equal the literal previously used in
// posting.ts / inventory-posting.ts so nothing changes until overridden.
export const ACCOUNT_SLOTS: readonly AccountSlot[] = [
    // Order payment / escrow / revenue
    { slot: "payment_gateway_cash", label: "Kas di Payment Gateway (saat buyer bayar)", group: "Order & Pembayaran", defaultCode: "11300" },
    { slot: "escrow", label: "Escrow / Pendapatan Diterima di Muka", group: "Order & Pembayaran", defaultCode: "23000" },
    { slot: "seller_wallet_payable", label: "Utang ke Seller (saldo wallet)", group: "Order & Pembayaran", defaultCode: "22000" },
    { slot: "order_revenue", label: "Pendapatan Penjualan (komisi platform saat release)", group: "Order & Pembayaran", defaultCode: "41000" },
    { slot: "ppn_out", label: "PPN Keluaran", group: "Pajak", defaultCode: "24100" },
    { slot: "operating_cash", label: "Kas Operasional (bank)", group: "Kas & Bank", defaultCode: "11100" },
    { slot: "receivable", label: "Piutang Usaha", group: "Kas & Bank", defaultCode: "12100" },
    // Refund
    { slot: "refund_payable", label: "Utang Refund ke Buyer", group: "Refund", defaultCode: "22100" },
    // Payout
    { slot: "bank_fee_expense", label: "Beban Biaya Bank (payout)", group: "Payout", defaultCode: "65100" },
    // Platform fee revenue
    { slot: "fee_revenue_listing", label: "Pendapatan Fee — Listing", group: "Fee Platform", defaultCode: "41100" },
    { slot: "fee_revenue_promoted", label: "Pendapatan Fee — Promoted", group: "Fee Platform", defaultCode: "41200" },
    { slot: "fee_revenue_subscription", label: "Pendapatan Fee — Subscription", group: "Fee Platform", defaultCode: "41300" },
    { slot: "fee_revenue_convenience", label: "Pendapatan Fee — Convenience", group: "Fee Platform", defaultCode: "41500" },
    // Affiliate
    { slot: "affiliate_commission_expense", label: "Beban Komisi Affiliate", group: "Affiliate", defaultCode: "66000" },
    { slot: "affiliate_payable", label: "Utang Komisi Affiliate", group: "Affiliate", defaultCode: "22200" },
    { slot: "wht_pph22", label: "Utang PPh 22 (marketplace PMK 37/2025)", group: "Pajak", defaultCode: "24700" },
    { slot: "wht_pph23", label: "Utang PPh 23 (withholding)", group: "Pajak", defaultCode: "24200" },
    { slot: "wht_pph21", label: "Utang PPh 21 (withholding)", group: "Pajak", defaultCode: "24300" },
    { slot: "wht_pph42", label: "Utang PPh 4(2) (withholding)", group: "Pajak", defaultCode: "24400" },
    // Inventory / first-party (1P)
    { slot: "inventory_asset", label: "Persediaan Barang (1P)", group: "Inventory 1P", defaultCode: "13100" },
    { slot: "inventory_payable", label: "Utang Pembelian Persediaan", group: "Inventory 1P", defaultCode: "21100" },
    { slot: "cogs", label: "Harga Pokok Penjualan (HPP)", group: "Inventory 1P", defaultCode: "51100" },
    { slot: "inventory_shrinkage", label: "Beban Penyusutan/Selisih Stok", group: "Inventory 1P", defaultCode: "69000" },
];

export const SLOT_DEFAULTS: Record<string, string> = Object.fromEntries(
    ACCOUNT_SLOTS.map((s) => [s.slot, s.defaultCode])
);

export function settingKey(slot: string): string {
    return `gl.account.${slot}`;
}

export interface AccountSlotState extends AccountSlot {
    currentCode: string;     // effective code right now (override or default)
    isOverridden: boolean;
}
