import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";

export default async function ProfileSettingsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const user = session.user;

    return (
        <div className="flex-1">
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                    Pengaturan Akun
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Kelola informasi pribadi, keamanan, dan preferensi notifikasi.
                </p>
            </div>

            <SettingsForm user={user} />
        </div>
    );
}
