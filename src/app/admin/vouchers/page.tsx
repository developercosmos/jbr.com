import { listVouchers } from "@/actions/vouchers";
import VouchersClient from "./VouchersClient";

export const dynamic = "force-dynamic";

export default async function AdminVouchersPage() {
    const vouchers = await listVouchers();

    const serialized = vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        type: v.type,
        value: Number(v.value),
        max_uses: v.max_uses,
        max_uses_per_user: v.max_uses_per_user,
        valid_from: v.valid_from.toISOString(),
        valid_to: v.valid_to ? v.valid_to.toISOString() : null,
        min_order_amount: v.min_order_amount === null ? null : Number(v.min_order_amount),
        is_active: v.is_active,
    }));

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                        Voucher
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Buat dan kelola voucher diskon, ongkir gratis, atau promo nominal tetap untuk checkout.
                    </p>
                </div>
                <VouchersClient initialVouchers={serialized} />
            </div>
        </div>
    );
}
