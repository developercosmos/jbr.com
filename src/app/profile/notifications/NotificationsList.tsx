"use client";

import { useState } from "react";
import { Check, CheckCheck, Trash2 } from "lucide-react";
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications";

type Notification = {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    data: unknown;
    read: boolean;
    read_at: Date | null;
    created_at: Date;
};

interface NotificationsListProps {
    initialNotifications: Notification[];
}

export function NotificationsList({ initialNotifications }: NotificationsListProps) {
    const [notifications, setNotifications] = useState(initialNotifications);

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markNotificationAsRead(notificationId);
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
            );
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case "ORDER_CREATED":
                return "🛒";
            case "PAYMENT_SUCCESS":
                return "✅";
            case "ORDER_SHIPPED":
                return "📦";
            case "ORDER_DELIVERED":
                return "🎉";
            case "NEW_MESSAGE":
                return "💬";
            case "NEW_REVIEW":
                return "⭐";
            case "REVIEW_REPLY":
                return "💬";
            default:
                return "🔔";
        }
    };

    const formatTime = (date: Date | string) => {
        const now = new Date();
        const notifDate = new Date(date);
        const diffMs = now.getTime() - notifDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Baru saja";
        if (diffMins < 60) return `${diffMins} menit lalu`;
        if (diffHours < 24) return `${diffHours} jam lalu`;
        if (diffDays < 7) return `${diffDays} hari lalu`;
        return notifDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div>
            {/* Actions */}
            {unreadCount > 0 && (
                <div className="flex justify-end mb-4">
                    <button
                        onClick={handleMarkAllAsRead}
                        className="flex items-center gap-2 text-sm text-brand-primary hover:underline"
                    >
                        <CheckCheck className="w-4 h-4" />
                        Tandai semua dibaca ({unreadCount})
                    </button>
                </div>
            )}

            {/* List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {notifications.map((notification, index) => (
                    <div
                        key={notification.id}
                        className={`p-5 ${index !== notifications.length - 1 ? "border-b border-slate-100" : ""} ${!notification.read ? "bg-blue-50/30" : ""
                            }`}
                    >
                        <div className="flex gap-4">
                            <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className={`text-slate-900 ${!notification.read ? "font-semibold" : ""}`}>
                                            {notification.title}
                                        </p>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-2">
                                            {formatTime(notification.created_at)}
                                        </p>
                                    </div>
                                    {!notification.read && (
                                        <button
                                            onClick={() => handleMarkAsRead(notification.id)}
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                            title="Tandai dibaca"
                                        >
                                            <Check className="w-4 h-4 text-slate-400" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
