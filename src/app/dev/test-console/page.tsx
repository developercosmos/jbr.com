import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
    listRecentOrdersForTest,
    testAdvanceOrder,
    type TestAction,
} from "@/actions/dev/test-console";

export const dynamic = "force-dynamic";

// Which actions to offer per status (mirrors the real lifecycle gates).
const ACTIONS_BY_STATUS: Record<string, { action: TestAction; label: string; className: string }[]> = {
    PENDING_PAYMENT: [
        { action: "PAY", label: "Bayar", className: "bg-emerald-600 hover:bg-emerald-700" },
        { action: "CANCEL", label: "Batal", className: "bg-red-600 hover:bg-red-700" },
    ],
    PAID: [
        { action: "PROCESS", label: "Proses", className: "bg-indigo-600 hover:bg-indigo-700" },
        { action: "SHIP", label: "Kirim", className: "bg-purple-600 hover:bg-purple-700" },
        { action: "CANCEL", label: "Batal", className: "bg-red-600 hover:bg-red-700" },
    ],
    PROCESSING: [
        { action: "SHIP", label: "Kirim", className: "bg-purple-600 hover:bg-purple-700" },
        { action: "CANCEL", label: "Batal", className: "bg-red-600 hover:bg-red-700" },
    ],
    SHIPPED: [{ action: "DELIVER", label: "Terima (Delivered)", className: "bg-blue-600 hover:bg-blue-700" }],
    DELIVERED: [{ action: "RELEASE", label: "Rilis Escrow (Selesai)", className: "bg-green-600 hover:bg-green-700" }],
};

const STATUS_COLOR: Record<string, string> = {
    PENDING_PAYMENT: "bg-amber-100 text-amber-700",
    PAID: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-indigo-100 text-indigo-700",
    SHIPPED: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-cyan-100 text-cyan-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUNDED: "bg-slate-100 text-slate-700",
};

function fmtIDR(v: string) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(v));
}

export default async function TestConsolePage() {
    // Hard gate: never exists in production; admin-only otherwise.
    if (process.env.NODE_ENV === "production") notFound();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) notFound();
    const me = await db.query.users.findFirst({ where: eq(users.id, session.user.id), columns: { role: true } });
    if (me?.role !== "ADMIN") notFound();

    const orders = await listRecentOrdersForTest(40);

    async function act(formData: FormData) {
        "use server";
        const orderId = String(formData.get("orderId") || "");
        const action = String(formData.get("action") || "") as TestAction;
        if (!orderId || !action) return;
        await testAdvanceOrder(orderId, action);
        revalidatePath("/dev/test-console");
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                    DEV ONLY · non-production
                </div>
                <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">Test Console — Siklus Pesanan</h1>
                <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                    Jalankan satu siklus penuh tanpa Xendit/kurir asli. <strong>Bayar</strong> memakai handler webhook asli
                    (ledger + escrow + notifikasi). <strong>Rilis Escrow</strong> menjalankan sweep auto-release sungguhan.
                    Untuk menguji halaman bayar Xendit secara nyata, jalankan simulator di folder <code>/sim</code> dan arahkan
                    <code> XENDIT_API_URL</code> ke sana.
                </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-black/20 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Order</th>
                            <th className="px-4 py-3">Pembeli → Penjual</th>
                            <th className="px-4 py-3">Total</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {orders.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada order. Buat order dari checkout dulu.</td></tr>
                        )}
                        {orders.map((o) => {
                            const actions = ACTIONS_BY_STATUS[o.status] ?? [];
                            return (
                                <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5">
                                    <td className="px-4 py-3">
                                        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">#{o.orderNumber}</div>
                                        {o.trackingNumber && <div className="text-[10px] text-slate-400">resi {o.trackingNumber}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                        {o.buyerName} <span className="text-slate-400">→</span> {o.sellerName}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{fmtIDR(o.total)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[o.status] ?? "bg-slate-100 text-slate-700"}`}>
                                            {o.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {actions.length === 0 ? (
                                                <span className="text-xs text-slate-400">—</span>
                                            ) : (
                                                actions.map((a) => (
                                                    <form key={a.action} action={act}>
                                                        <input type="hidden" name="orderId" value={o.id} />
                                                        <input type="hidden" name="action" value={a.action} />
                                                        <button type="submit" className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-colors ${a.className}`}>
                                                            {a.label}
                                                        </button>
                                                    </form>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Urutan 1 siklus penuh:</p>
                <p>Checkout → <strong>Bayar</strong> (PAID) → <strong>Proses</strong> → <strong>Kirim</strong> (SHIPPED) → <strong>Terima</strong> (DELIVERED) → <strong>Rilis Escrow</strong> (COMPLETED, dana ke wallet seller).</p>
            </div>
        </div>
    );
}
