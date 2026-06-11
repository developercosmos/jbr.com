"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, RotateCcw } from "lucide-react";
import { deleteProduct, publishProduct } from "@/actions/products";

export default function DeleteProductButton({
    productId,
    productTitle,
    status,
}: {
    productId: string;
    productTitle: string;
    status?: string;
}) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const isArchived = status === "ARCHIVED";

    const onDelete = () => {
        if (
            !confirm(
                `Hapus produk "${productTitle}"?\n\nJika produk sudah pernah ada transaksi, produk akan DINONAKTIFKAN (bukan dihapus permanen) agar riwayat pesanan pembeli tetap utuh.`
            )
        )
            return;
        start(async () => {
            try {
                const res = await deleteProduct(productId);
                if (res && "archived" in res && res.archived) {
                    alert(
                        "Produk dinonaktifkan karena sudah memiliki riwayat transaksi. Produk tidak lagi tampil di katalog. Anda bisa mengaktifkannya kembali kapan saja."
                    );
                }
                router.refresh();
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Gagal menghapus produk.";
                alert(
                    /server action|older or newer deployment/i.test(msg)
                        ? "Aplikasi baru saja diperbarui. Muat ulang halaman lalu coba lagi."
                        : msg
                );
            }
        });
    };

    const onReactivate = () => {
        start(async () => {
            try {
                const result = await publishProduct(productId);
                if (!result.success) {
                    alert(result.error || "Gagal mengaktifkan produk.");
                    return;
                }
                router.refresh();
            } catch (e) {
                alert(e instanceof Error ? e.message : "Gagal mengaktifkan produk.");
            }
        });
    };

    return (
        <div className="inline-flex items-center gap-1">
            {isArchived && (
                <button
                    type="button"
                    onClick={onReactivate}
                    disabled={pending}
                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Aktifkan kembali"
                >
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                </button>
            )}
            <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                title={isArchived ? "Hapus permanen (hanya jika tanpa transaksi)" : "Hapus / Nonaktifkan"}
            >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
        </div>
    );
}
