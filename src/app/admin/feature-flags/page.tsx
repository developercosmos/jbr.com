import { ensureInitialFeatureFlags, listAdminFeatureFlags } from "@/actions/admin/feature-flags";
import { FeatureFlagsClient } from "./FeatureFlagsClient";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
    await ensureInitialFeatureFlags();
    const { flags, killSwitch } = await listAdminFeatureFlags();

    return (
        <div className="flex-1 p-8">
            <div className="max-w-6xl mx-auto">
                <FeatureFlagsClient initialFlags={flags} killSwitch={killSwitch ?? null} />
            </div>
        </div>
    );
}