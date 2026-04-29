import { listAffiliatesForAdmin } from "@/actions/affiliate";
import AffiliatesAdminClient from "./AffiliatesAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
    const accounts = await listAffiliatesForAdmin();
    const serialized = accounts.map((a) => ({
        userId: a.user_id,
        code: a.code,
        status: a.status,
        rateOverride: a.commission_rate_override === null ? null : Number(a.commission_rate_override),
        payoutMethod: a.payout_method,
        payoutAccount: a.payout_account,
        reviewNotes: a.review_notes,
        reviewedAt: a.reviewed_at?.toISOString() ?? null,
        userName: a.user?.name ?? null,
        userEmail: a.user?.email ?? null,
    }));

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                        Affiliate Accounts
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Kelola akun afiliasi, override rate komisi per akun, suspend yang melanggar, dan jalankan batch
                        payout untuk komisi yang sudah CLEARED.
                    </p>
                </div>
                <AffiliatesAdminClient initial={serialized} />
            </div>
        </div>
    );
}
