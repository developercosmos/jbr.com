"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications";
import { useHeaderCounters } from "@/hooks/useHeaderCounters";

type Notification = Awaited<ReturnType<typeof getNotifications>>[number];

type NotificationBellProps = {
    isAuthenticated: boolean;
};

export function NotificationBell({ isAuthenticated }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { unreadNotificationCount, refreshCounters } = useHeaderCounters(isAuthenticated);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch notifications when dropdown opens
    useEffect(() => {
        if (isOpen && isAuthenticated) {
            fetchNotifications();
        }
    }, [isOpen, isAuthenticated]);

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const data = await getNotifications(10);
            setNotifications(data);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markNotificationAsRead(notificationId);
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
            );
            await refreshCounters();
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            await refreshCounters();
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
        return notifDate.toLocaleDateString("id-ID");
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadNotificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200">
                        <h3 className="font-bold text-slate-900">Notifikasi</h3>
                        {unreadNotificationCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                            >
                                <CheckCheck className="w-3 h-3" />
                                Tandai semua dibaca
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-8 text-center text-slate-500">
                                <div className="animate-pulse">Memuat...</div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <p>Belum ada notifikasi</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${!notification.read ? "bg-blue-50/50" : ""
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm ${!notification.read ? "font-semibold" : ""} text-slate-900`}>
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {formatTime(notification.created_at)}
                                            </p>
                                        </div>
                                        {!notification.read && (
                                            <button
                                                onClick={() => handleMarkAsRead(notification.id)}
                                                className="p-1 hover:bg-slate-200 rounded transition-colors"
                                                aria-label="Mark as read"
                                            >
                                                <Check className="w-4 h-4 text-slate-400" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <Link
                        href="/profile/notifications"
                        className="block p-3 text-center text-sm font-medium text-brand-primary hover:bg-slate-50 border-t border-slate-200"
                        onClick={() => setIsOpen(false)}
                    >
                        Lihat Semua Notifikasi
                    </Link>
                </div>
            )}
        </div>
    );
}
