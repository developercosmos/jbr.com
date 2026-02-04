"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    store_name: string | null;
    store_status: string | null;
    created_at: Date;
}

interface ExportUsersButtonProps {
    users: User[];
}

export function ExportUsersButton({ users }: ExportUsersButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = () => {
        setIsExporting(true);

        try {
            // Create CSV content
            const headers = ["ID", "Nama", "Email", "Role", "Toko", "Status", "Tanggal Daftar"];
            const rows = users.map((user) => [
                user.id,
                user.name,
                user.email,
                user.role,
                user.store_name || "-",
                user.store_status || "Active",
                new Date(user.created_at).toLocaleDateString("id-ID"),
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map((row) =>
                    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
                ),
            ].join("\n");

            // Create and download file
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isExporting || users.length === 0}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-brand-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
            {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
                <Download className="w-5 h-5" />
            )}
            <span>Export</span>
        </button>
    );
}
