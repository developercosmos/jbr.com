import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAffiliateDashboard } from "@/actions/affiliate";
import AffiliateDashboardClient from "./AffiliateDashboardClient";

export const dynamic = "force-dynamic";

export default async function AffiliatePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login?callbackUrl=/affiliate");

    const data = await getAffiliateDashboard();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                    Program Afiliasi
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Bagikan link unik Anda dan dapatkan komisi dari setiap pembelian yang berhasil diselesaikan dalam
                    masa atribusi.
                </p>
            </div>
            <AffiliateDashboardClient initial={data} baseUrl={baseUrl} />
        </div>
    );
}
