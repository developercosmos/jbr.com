import { listKycSubmissions, getKycSubmissionCounts } from "@/actions/kyc";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import KycReviewClient from "./KycReviewClient";

export const dynamic = "force-dynamic";

interface PageProps {
    searchParams: Promise<{ status?: string }>;
}

const STATUS_FILTERS = ["PENDING_REVIEW", "APPROVED", "REJECTED", "NOT_SUBMITTED"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function isStatusFilter(value: string | undefined): value is StatusFilter {
    return value !== undefined && (STATUS_FILTERS as readonly string[]).includes(value);
}

export default async function AdminKycPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const statusFilter: StatusFilter = isStatusFilter(params.status) ? params.status : "PENDING_REVIEW";

    const [submissions, counts, pendingSellerActivation] = await Promise.all([
        listKycSubmissions({ status: statusFilter }),
        getKycSubmissionCounts(),
        db.select({ count: sql<number>`count(*)` })
            .from(users)
            .where(eq(users.store_status, "PENDING_REVIEW"))
            .then((r) => Number(r[0]?.count ?? 0)),
    ]);

    const serialized = submissions.map((s) => ({
        userId: s.user_id,
        tier: s.tier,
        status: s.status,
        notes: s.notes,
        submittedAt: s.submitted_at?.toISOString() ?? null,
        reviewedAt: s.reviewed_at?.toISOString() ?? null,
        seller: s.seller,
        ktpFile: s.ktpFile,
        selfieFile: s.selfieFile,
        businessDocFile: s.businessDocFile,
        reviewer: s.reviewer,
    }));

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                        Review KYC Seller
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Verifikasi identitas seller untuk peningkatan tier dan pembukaan limit transaksi.
                    </p>
                </div>

                {pendingSellerActivation > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Ada <span className="font-bold">{pendingSellerActivation}</span> seller menunggu review aktivasi toko.
                        Lanjutkan review di
                        <a href="/admin/users" className="ml-1 font-semibold underline hover:no-underline">
                            halaman Users
                        </a>
                        .
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {STATUS_FILTERS.map((status) => (
                        <a
                            key={status}
                            href={`/admin/kyc?status=${status}`}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                                statusFilter === status
                                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-primary/50"
                            }`}
                        >
                            {status.replace("_", " ")}
                            <span className="ml-2 inline-flex items-center justify-center text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                {counts[status] ?? 0}
                            </span>
                        </a>
                    ))}
                </div>

                <KycReviewClient submissions={serialized} />
            </div>
        </div>
    );
}
