import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { feature_flags, feature_flag_audit_log, product_event_daily } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ChartLine } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * FLAG-11: Per-flag impact dashboard.
 *
 * For each flag we render:
 *   1. Toggle history (last 30 changes) from feature_flag_audit_log.
 *   2. PDP event count last 14 days, filtered to event types tied to the
 *      flag's feature (best-effort mapping by key prefix).
 *   3. Variant breakdown if `variants` is configured (current weight config).
 *
 * Production-ready as a "good enough" baseline. Statistical significance
 * test (chi-square) is out of scope for v2.1 — operators can export raw
 * counts and run analysis externally.
 */

const KEY_TO_EVENT_TYPES: Record<string, string[]> = {
    "pdp.inline_offer": ["OFFER_INPUT_FOCUS", "OFFER_SUBMIT", "OFFER_SUBMIT_SUCCESS"],
    "pdp.offer_rate_limit": ["OFFER_RATE_LIMITED"],
    "pdp.seller_badges": ["SELLER_BADGE_VIEW", "SELLER_CARD_CLICK"],
    "dif.smart_questions": ["CHAT_SUGGESTION_USED", "CHAT_INITIATED_FROM_PDP"],
    "dif.intent_score": ["PDP_TIME_ON_PAGE_BUCKET"],
    "dif.live_presence": ["IMPRESSION"],
};

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "ADMIN") notFound();
    return session.user;
}

export default async function FlagImpactPage({ params }: { params: Promise<{ key: string }> }) {
    await requireAdmin();
    const { key } = await params;
    const decoded = decodeURIComponent(key);

    const flag = await db.query.feature_flags.findFirst({
        where: eq(feature_flags.key, decoded),
    });
    if (!flag) notFound();

    const audit = await db.query.feature_flag_audit_log.findMany({
        where: eq(feature_flag_audit_log.flag_key, decoded),
        orderBy: [desc(feature_flag_audit_log.created_at)],
        limit: 30,
    });

    const eventTypes = KEY_TO_EVENT_TYPES[decoded] ?? [];
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString().slice(0, 10);

    const eventStats = eventTypes.length
        ? await db
              .select({
                  date: product_event_daily.date,
                  event_type: product_event_daily.event_type,
                  total: sql<number>`coalesce(sum(${product_event_daily.count}), 0)::int`,
              })
              .from(product_event_daily)
              .where(
                  and(
                      sql`${product_event_daily.event_type} = ANY(${eventTypes})`,
                      sql`${product_event_daily.date} >= ${sinceIso}`
                  )
              )
              .groupBy(product_event_daily.date, product_event_daily.event_type)
              .orderBy(product_event_daily.date)
        : [];

    const variantWeights = (flag.variants ?? null) as Record<string, number> | null;

    return (
        <main className="flex-1 p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/feature-flags" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-primary">
                        ← Kembali ke daftar flag
                    </Link>
                    <h1 className="text-2xl font-heading font-bold tracking-tight text-slate-900 uppercase mt-2 flex items-center gap-3">
                        <ChartLine className="w-6 h-6 text-brand-primary" />
                        Impact: {flag.key}
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">{flag.description}</p>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <h2 className="font-semibold text-slate-900">Status saat ini</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                            <div className="text-slate-500">Enabled</div>
                            <div className="font-bold">{flag.enabled ? "ya" : "tidak"}</div>
                        </div>
                        <div>
                            <div className="text-slate-500">Rollout</div>
                            <div className="font-bold">{flag.rollout_pct}%</div>
                        </div>
                        <div>
                            <div className="text-slate-500">Category</div>
                            <div className="font-bold">{flag.category}</div>
                        </div>
                        <div>
                            <div className="text-slate-500">Owner</div>
                            <div className="font-bold">{flag.owner ?? "-"}</div>
                        </div>
                    </div>
                </section>

                {variantWeights && Object.keys(variantWeights).length > 0 && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                        <h2 className="font-semibold text-slate-900">Distribusi Variant</h2>
                        <div className="space-y-2">
                            {Object.entries(variantWeights).map(([variant, weight]) => (
                                <div key={variant}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-mono">{variant}</span>
                                        <span className="font-bold">{weight}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full bg-brand-primary" style={{ width: `${weight}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <h2 className="font-semibold text-slate-900">Event Counts (14 hari, mapping kasar)</h2>
                    {eventStats.length === 0 ? (
                        <p className="text-sm text-slate-500">
                            Belum ada mapping event ke flag ini, atau belum ada data 14 hari terakhir.
                        </p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                                    <th className="py-2">Date</th>
                                    <th className="py-2">Event Type</th>
                                    <th className="py-2 text-right">Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eventStats.map((row, i) => (
                                    <tr key={`${row.date}-${row.event_type}-${i}`} className="border-b border-slate-100">
                                        <td className="py-2">{String(row.date)}</td>
                                        <td className="py-2 font-mono">{row.event_type}</td>
                                        <td className="py-2 text-right font-bold">{Number(row.total).toLocaleString("id-ID")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <h2 className="font-semibold text-slate-900">Toggle History (30 terakhir)</h2>
                    {audit.length === 0 ? (
                        <p className="text-sm text-slate-500">Belum ada perubahan tercatat.</p>
                    ) : (
                        <ul className="text-sm divide-y divide-slate-100">
                            {audit.map((row) => {
                                const before = (row.before_state ?? {}) as { enabled?: boolean; rollout_pct?: number };
                                const after = (row.after_state ?? {}) as { enabled?: boolean; rollout_pct?: number };
                                return (
                                    <li key={row.id} className="py-2">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <span className="text-slate-500">
                                                {new Date(row.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                                            </span>
                                            <span className="text-xs font-mono text-slate-400">
                                                enabled {String(before.enabled)} → {String(after.enabled)} · pct {before.rollout_pct ?? "-"} → {after.rollout_pct ?? "-"}
                                            </span>
                                        </div>
                                        {row.reason && <div className="text-slate-700 italic mt-1">"{row.reason}"</div>}
                                        {row.confirmation_phrase && (
                                            <div className="text-[10px] uppercase tracking-wide text-amber-700 mt-1">
                                                Konfirmasi: {row.confirmation_phrase}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}
