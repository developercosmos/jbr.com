import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { listPayoutsForAdmin } from "@/actions/payouts";
import { PayoutsClient } from "./PayoutsClient";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
    await requireAdminFinanceSession();
    const rows = await listPayoutsForAdmin();
    const payouts = rows.map((p) => ({
        ...p,
        created_at: (p.created_at as Date).toISOString(),
    }));

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Penarikan Saldo Seller</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Setujui untuk memicu transfer Xendit ke rekening seller. Saldo seller (akun 22000) berkurang
                    setelah transfer dikonfirmasi (webhook).
                </p>
            </div>
            <PayoutsClient payouts={payouts} />
        </div>
    );
}
