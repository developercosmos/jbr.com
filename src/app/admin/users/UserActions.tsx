"use client";

import { Ban, RefreshCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { banUser, unbanUser, deleteUser } from "@/actions/admin";
import { EditUserButton } from "./EditUserButton";

interface UserData {
    id: string;
    name: string | null;
    email: string;
    role: "USER" | "ADMIN";
}

export function UserActions({ user, isBanned }: { user: UserData; isBanned: boolean }) {
    const [isPending, startTransition] = useTransition();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    const handleDelete = () => {
        startTransition(async () => {
            try {
                await deleteUser(user.id);
            } catch (error: any) {
                alert(error.message || "Gagal menghapus user");
            }
            setShowDeleteConfirm(false);
        });
    };

    return (
        <>
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
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isPending}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete User"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            Hapus User?
                        </h3>
                        <p className="text-slate-500 mb-4">
                            Apakah Anda yakin ingin menghapus <strong>{user.name || user.email}</strong>?
                            Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {isPending ? "Menghapus..." : "Hapus User"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

