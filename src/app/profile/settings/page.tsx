import { db } from "@/db";
import { addresses, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
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

    const [user, defaultShippingAddress, latestAddress] = await Promise.all([
        db.query.users.findFirst({
            where: eq(users.id, session.user.id),
            columns: {
                id: true,
                name: true,
                email: true,
                image: true,
                phone: true,
                locale: true,
            },
        }),
        db.query.addresses.findFirst({
            where: eq(addresses.user_id, session.user.id),
            columns: {
                phone: true,
            },
            orderBy: [desc(addresses.is_default_shipping), desc(addresses.created_at)],
        }),
        db.query.addresses.findFirst({
            where: eq(addresses.user_id, session.user.id),
            columns: {
                phone: true,
            },
            orderBy: [desc(addresses.created_at)],
        }),
    ]);
    const safeDecryptPhone = (value: string | null | undefined) => {
        if (!value) return "";
        try {
            return decryptPdpField(value) || "";
        } catch {
            return value;
        }
    };

    if (!user) {
        redirect("/auth/login");
    }

    const resolvedPhone =
        safeDecryptPhone(user.phone) ||
        defaultShippingAddress?.phone ||
        latestAddress?.phone ||
        "";

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
                    phone: resolvedPhone,
                }}
            />
        </div>
    );
}
