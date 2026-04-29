import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";
import { decryptPdpField } from "@/lib/crypto/pdp-field";

export default async function ProfileSettingsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            locale: true,
        },
    });

    if (!user) {
        redirect("/auth/login");
    }

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

            <SettingsForm
                user={{
                    ...user,
                    phone: decryptPdpField(user.phone),
                }}
            />
        </div>
    );
}
