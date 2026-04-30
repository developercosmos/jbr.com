import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getInteractionTimeline } from "@/actions/interaction-timeline";
import { InteractionTimeline } from "@/components/timeline/InteractionTimeline";

export const dynamic = "force-dynamic";

export default async function DisputeTimelinePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    let result: Awaited<ReturnType<typeof getInteractionTimeline>>;
    try {
        result = await getInteractionTimeline({ disputeId: id });
    } catch {
        notFound();
    }

    const events = result!.events.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString(),
    }));

    return (
        <main className="flex-1 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="mb-6">
                    <Link href="/admin/disputes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-primary">
                        ← Kembali ke daftar dispute
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase mt-2 flex items-center gap-3">
                        <ShieldCheck className="w-7 h-7 text-brand-primary" />
                        Audit Replay (Trust)
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Bukti kronologis untuk dispute resolution. Chat sudah disanitasi (nomor / link / email di-mask).
                    </p>
                </div>
                <InteractionTimeline events={events} />
            </div>
        </main>
    );
}
