"use client";

import { Ban, RefreshCcw } from "lucide-react";
import { useTransition } from "react";
import { banUser, unbanUser } from "@/actions/admin";
import { EditUserButton } from "./EditUserButton";

interface UserData {
    id: string;
    name: string | null;
    email: string;
    role: "USER" | "ADMIN";
}

export function UserActions({ user, isBanned }: { user: UserData; isBanned: boolean }) {
    const [isPending, startTransition] = useTransition();

    const handleBan = () => {
        startTransition(async () => {
            await banUser(user.id);
        });
    };

    const handleUnban = () => {
        startTransition(async () => {
            await unbanUser(user.id);
        });
    };

    return (
        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <EditUserButton user={user} />
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
        </div>
    );
}
