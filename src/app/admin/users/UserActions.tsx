"use client";

import { Lock, Ban, ChevronRight, RefreshCcw } from "lucide-react";
import { useTransition } from "react";
import { banUser, unbanUser } from "@/actions/admin";

export function UserActions({ userId, isBanned }: { userId: string; isBanned: boolean }) {
    const [isPending, startTransition] = useTransition();

    const handleBan = () => {
        startTransition(async () => {
            await banUser(userId);
        });
    };

    const handleUnban = () => {
        startTransition(async () => {
            await unbanUser(userId);
        });
    };

    return (
        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
                title="Reset Password"
                disabled={isPending}
            >
                <Lock className="w-4 h-4" />
            </button>
            {isBanned ? (
                <button
                    onClick={handleUnban}
                    disabled={isPending}
                    className="p-2 rounded-lg text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
                    title="Unban User"
                >
                    <RefreshCcw className="w-4 h-4" />
                </button>
            ) : (
                <button
                    onClick={handleBan}
                    disabled={isPending}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Ban User"
                >
                    <Ban className="w-4 h-4" />
                </button>
            )}
            <button
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-primary transition-colors"
                title="View Details"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}
