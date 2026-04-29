import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { ensureInitialFeatureFlags, listAdminFeatureFlags } from "@/actions/admin/feature-flags";
import { KillSwitchClient } from "./KillSwitchClient";

export const dynamic = "force-dynamic";

export default async function FeatureFlagKillSwitchPage() {
    await ensureInitialFeatureFlags();
    const { killSwitch } = await listAdminFeatureFlags();

    return (
        <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/feature-flags" className="inline-flex items-center gap-2 text-brand-primary hover:underline mb-3">
                        <ArrowLeft className="w-4 h-4" />
                        Kembali ke Feature Flags
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase flex items-center gap-3">
                        <ShieldAlert className="w-7 h-7 text-rose-600" />
                        Emergency Kill-Switch
                    </h1>
                    <p className="text-slate-500 mt-1">Kontrol darurat untuk mematikan fitur baru berdasarkan scope tanpa redeploy.</p>
                </div>

                <KillSwitchClient current={killSwitch ?? null} />
            </div>
        </div>
    );
}