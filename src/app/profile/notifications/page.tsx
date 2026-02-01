import Link from "next/link";
import { Bell, CheckCheck, ArrowLeft } from "lucide-react";
import { getNotifications, markAllNotificationsAsRead } from "@/actions/notifications";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NotificationsList } from "./NotificationsList";

type Notification = Awaited<ReturnType<typeof getNotifications>>[number];

export default async function NotificationsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login?redirect=/profile/notifications");
    }

    let notifications: Notification[] = [];
    try {
        notifications = await getNotifications(50);
    } catch {
        // Use default empty array
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/profile"
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900">Notifikasi</h1>
                    </div>
                </div>

                {/* Notifications List */}
                {notifications.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-slate-700 mb-2">
                            Belum Ada Notifikasi
                        </h2>
                        <p className="text-slate-500">
                            Notifikasi akan muncul di sini ketika ada update pesanan, pesan baru, atau aktivitas lainnya.
                        </p>
                    </div>
                ) : (
                    <NotificationsList initialNotifications={notifications} />
                )}
            </div>
        </div>
    );
}
