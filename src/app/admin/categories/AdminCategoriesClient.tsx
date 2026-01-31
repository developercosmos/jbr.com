"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, FolderOpen, Loader2, X, Save } from "lucide-react";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";

type Category = {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    parent_id: string | null;
    created_at: Date;
    productCount: number;
};

interface AdminCategoriesClientProps {
    initialCategories: Category[];
}

export function AdminCategoriesClient({ initialCategories }: AdminCategoriesClientProps) {
    const [categories, setCategories] = useState(initialCategories);
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({ name: "", slug: "", image: "" });
    const [error, setError] = useState("");

    const handleCreate = () => {
        setEditingCategory(null);
        setFormData({ name: "", slug: "", image: "" });
        setShowForm(true);
        setError("");
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            slug: category.slug,
            image: category.image || "",
        });
        setShowForm(true);
        setError("");
    };

    const handleDelete = (category: Category) => {
        if (category.productCount > 0) {
            setError(`Tidak dapat menghapus kategori "${category.name}" karena masih memiliki ${category.productCount} produk`);
            return;
        }

        if (!confirm(`Yakin ingin menghapus kategori "${category.name}"?`)) {
            return;
        }

        startTransition(async () => {
            try {
                await deleteCategory(category.id);
                setCategories(prev => prev.filter(c => c.id !== category.id));
                setError("");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menghapus kategori");
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.slug.trim()) {
            setError("Nama dan slug wajib diisi");
            return;
        }

        startTransition(async () => {
            try {
                if (editingCategory) {
                    // Update
                    const result = await updateCategory({
                        id: editingCategory.id,
                        name: formData.name.trim(),
                        slug: formData.slug.trim(),
                        image: formData.image.trim() || undefined,
                    });
                    setCategories(prev =>
                        prev.map(c =>
                            c.id === editingCategory.id
                                ? { ...c, ...result.category }
                                : c
                        )
                    );
                } else {
                    // Create
                    const result = await createCategory({
                        name: formData.name.trim(),
                        slug: formData.slug.trim(),
                        image: formData.image.trim() || undefined,
                    });
                    setCategories(prev => [
                        { ...result.category, productCount: 0 },
                        ...prev,
                    ]);
                }
                setShowForm(false);
                setError("");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menyimpan kategori");
            }
        });
    };

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    };

    return (
        <div>
            {/* Error Message */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Add Button */}
            <div className="mb-6">
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Kategori
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">
                            {editingCategory ? "Edit Kategori" : "Tambah Kategori Baru"}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nama Kategori
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            name: e.target.value,
                                            slug: prev.slug || generateSlug(e.target.value),
                                        }));
                                    }}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                    placeholder="Raket Badminton"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Slug (URL)
                                </label>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                    placeholder="raket-badminton"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    URL: /category/{formData.slug || "slug"}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    URL Gambar (opsional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.image}
                                    onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Categories Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Kategori
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Slug
                            </th>
                            <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Produk
                            </th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Aksi
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {categories.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500">Belum ada kategori</p>
                                    <p className="text-sm text-slate-400">Klik "Tambah Kategori" untuk membuat kategori baru</p>
                                </td>
                            </tr>
                        ) : (
                            categories.map((category) => (
                                <tr key={category.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {category.image ? (
                                                <img
                                                    src={category.image}
                                                    alt={category.name}
                                                    className="w-10 h-10 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    <FolderOpen className="w-5 h-5 text-slate-400" />
                                                </div>
                                            )}
                                            <span className="font-medium text-slate-900">{category.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <code className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                            {category.slug}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-full">
                                            {category.productCount}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(category)}
                                                className="p-2 text-slate-500 hover:text-brand-primary hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category)}
                                                disabled={isPending}
                                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                title="Hapus"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
