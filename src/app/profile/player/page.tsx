import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPlayerProfile } from "@/actions/niche";
import PlayerProfileForm from "./PlayerProfileForm";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login?callbackUrl=/profile/player");

    const profile = await getPlayerProfile(session.user.id);

    return (
        <div className="max-w-2xl mx-auto p-8 space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                    Profil Pemain
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Lengkapi profil agar JBR merekomendasikan raket sesuai gaya main Anda.
                </p>
            </div>
            <PlayerProfileForm
                initial={
                    profile
                        ? {
                            level: profile.level,
                            playStyle: profile.play_style,
                            dominantHand: profile.dominant_hand,
                            preferredWeightClass: profile.preferred_weight_class,
                            preferredBalance: profile.preferred_balance,
                            preferredShaftFlex: profile.preferred_shaft_flex,
                        }
                        : null
                }
            />
        </div>
    );
}
