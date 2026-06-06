"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteProduct } from "@/actions/products";

export default function DeleteProductButton({
    productId,
    productTitle,
}: {
    productId: string;
    productTitle: string;
}) {
    const router = useRouter();
    const [pending, start] = useTransition();

    const onDelete = () => {
        if (!confirm(`Hapus produk "${productTitle}"? Tindakan ini tidak bisa dibatalkan.`)) return;
        start(async () => {
            try {
                await deleteProduct(productId);
                router.refresh();
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Gagal menghapus produk.";
                alert(/server action|older or newer deployment/i.test(msg)
                    ? "Aplikasi baru saja diperbarui. Muat ulang halaman lalu coba lagi."
                    : msg);
            }
        });
    };

    return (
        <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            title="Hapus"
        >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
    );
}
