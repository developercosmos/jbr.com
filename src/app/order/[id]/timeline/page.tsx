import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import Link from "next/link";
import { getInteractionTimeline } from "@/actions/interaction-timeline";
import { InteractionTimeline } from "@/components/timeline/InteractionTimeline";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function OrderTimelinePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const enabled = await isFeatureEnabled("dif.audit_replay");
    if (!enabled) notFound();

    let result: Awaited<ReturnType<typeof getInteractionTimeline>>;
    try {
        result = await getInteractionTimeline({ orderId: id });
    } catch {
        notFound();
    }

    const events = result!.events.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString(),
    }));

    return (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
                <Link
                    href={`/profile/orders/${id}`}
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-primary"
                >
                    ← Kembali ke order
                </Link>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase mt-2 flex items-center gap-3">
                    <Clock className="w-7 h-7 text-brand-primary" />
                    Riwayat Interaksi
                </h1>
                <p className="text-slate-500 mt-1">
                    Audit replay urutan kejadian untuk transparansi dan resolusi sengketa.
                </p>
            </div>

            <InteractionTimeline events={events} />
        </main>
    );
}
