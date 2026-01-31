import { getCategoriesWithCount } from "@/actions/categories";
import { AdminCategoriesClient } from "./AdminCategoriesClient";

export default async function AdminCategoriesPage() {
    const categories = await getCategoriesWithCount();

    return (
        <div className="flex-1 p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Kelola Kategori</h1>
                <p className="text-slate-500">Tambah, edit, atau hapus kategori produk</p>
            </div>

            {/* Client Component for Interactive Features */}
            <AdminCategoriesClient initialCategories={categories} />
        </div>
    );
}
