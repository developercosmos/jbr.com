"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications";
import { useHeaderCounters } from "@/hooks/useHeaderCounters";

type Notification = Awaited<ReturnType<typeof getNotifications>>[number];

type NotificationBellProps = {
    isAuthenticated: boolean;
};

/**
 * Map a notification's type + data payload to the route the user should land
 * on. Returns null when the notification has no actionable target (e.g. SYSTEM
 * announcements) — in that case we still mark-as-read on click but don't
 * navigate.
 *
 * Server-side `notify()` writes structured `data` for each event:
 *   - ORDER_*       → { order_id, order_number }
 *   - REVIEW_*      → { review_id, product_id }
 *   - DISPUTE_*     → { dispute_id, order_id, order_number }
 *   - OFFER_*       → { offer_id, product_title }
 *   - SELLER_*      → { seller_id, store_slug }
 */
function getNotificationHref(notification: Notification): string | null {
    const data = (notification.data ?? {}) as Record<string, unknown>;
    const orderId = typeof data.order_id === "string" ? data.order_id : null;
    const productId = typeof data.product_id === "string" ? data.product_id : null;
    const disputeId = typeof data.dispute_id === "string" ? data.dispute_id : null;
    const sellerId = typeof data.seller_id === "string" ? data.seller_id : null;
    const storeSlug = typeof data.store_slug === "string" ? data.store_slug : null;

    switch (notification.type) {
        case "ORDER_CREATED":
        case "PAYMENT_SUCCESS":
        case "ORDER_SHIPPED":
        case "ORDER_DELIVERED":
        case "ORDER_COMPLETED":
            return orderId ? `/profile/orders/${orderId}` : "/profile/orders";
        case "REVIEW_RECEIVED":
        case "NEW_REVIEW":
            return "/seller/reviews";
        case "REVIEW_REPLY":
            return productId ? `/product/${productId}` : "/profile/orders";
        case "NEW_MESSAGE":
            return "/messages";
        case "DISPUTE_OPENED":
        case "DISPUTE_UPDATED":
            return disputeId
                ? `/admin/disputes?id=${disputeId}`
                : (orderId ? `/profile/orders/${orderId}` : "/admin/disputes");
        case "OFFER_RECEIVED":
            return "/seller/offers";
        case "OFFER_ACCEPTED":
            return "/profile/offers";
        case "AFFILIATE_CONVERSION":
        case "PAYOUT_PROCESSED":
            return "/affiliate";
        case "SELLER_ACTIVATED":
            return storeSlug ? `/store/${storeSlug}` : "/seller";
        case "SELLER_REVIEW_NEEDED":
            return sellerId ? `/admin/users?highlight=${sellerId}` : "/admin/users";
        case "SYSTEM":
        default:
            return null;
    }
}

export function NotificationBell({ isAuthenticated }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { unreadNotificationCount, refreshCounters } = useHeaderCounters(isAuthenticated);

    function handleNotificationClick(notification: Notification) {
        // Optimistically mark as read locally so the row fades immediately.
        if (!notification.read) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
            );
            // Fire-and-forget server update; failures don't block navigation.
            markNotificationAsRead(notification.id)
                .then(() => refreshCounters())
                .catch((error) => {
                    console.error("Failed to mark notification as read:", error);
                });
        }

        const href = getNotificationHref(notification);
        setIsOpen(false);
        if (href) {
            router.push(href);
        }
    }

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
                            notifications.map((notification) => {
                                const hasTarget = getNotificationHref(notification) !== null;
                                return (
                                    <button
                                        type="button"
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${!notification.read ? "bg-blue-50/50" : ""} ${hasTarget ? "cursor-pointer" : "cursor-default"}`}
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
                                                <span
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkAsRead(notification.id);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.stopPropagation();
                                                            handleMarkAsRead(notification.id);
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-slate-200 rounded transition-colors flex-shrink-0"
                                                    aria-label="Tandai dibaca tanpa membuka"
                                                >
                                                    <Check className="w-4 h-4 text-slate-400" />
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
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
