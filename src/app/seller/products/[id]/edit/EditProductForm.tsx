"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
    Home, ChevronRight, X, Image as ImageIcon, ChevronDown, CheckCircle,
    Clock, Info, Save, AlertTriangle, Loader2, Upload
} from "lucide-react";
import { updateProduct, publishProduct, archiveProduct } from "@/actions/products";

interface Category {
    id: string;
    name: string;
    slug: string;
}

interface ProductData {
    id: string;
    title: string;
    description: string | null;
    brand: string | null;
    gender: "UNISEX" | "MEN" | "WOMEN";
    price: string;
    condition: "NEW" | "PRELOVED";
    condition_rating: number | null;
    condition_checklist: string[];
    weight_grams: number | null;
    stock: number;
    bargain_enabled: boolean;
    floor_price: string | null;
    tiered_floor_price: Record<string, number> | null;
    category_id: string | null;
    images: string[];
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "MODERATED";
}

interface EditProductFormProps {
    product: ProductData;
    categories: Category[];
    brands: string[];
}

const CONDITION_CHECKLIST_ITEMS = [
    "Frame tanpa retak",
    "Tidak ada penyok mayor",
    "Grommet masih layak",
    "Grip bersih dan nyaman",
    "Foto sesuai kondisi aktual",
];

export function EditProductForm({ product, categories, brands }: EditProductFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form state initialized from product
    const [title, setTitle] = useState(product.title);
    const [categoryId, setCategoryId] = useState(product.category_id ?? "");
    const [brand, setBrand] = useState(product.brand ?? "");
    const [gender, setGender] = useState<"UNISEX" | "MEN" | "WOMEN">(product.gender);
    const [description, setDescription] = useState(product.description ?? "");
    const [condition, setCondition] = useState<"NEW" | "PRELOVED">(product.condition);
    const [conditionRating, setConditionRating] = useState(product.condition_rating ?? 8);
    const [conditionChecklist, setConditionChecklist] = useState<string[]>(product.condition_checklist ?? []);
    const [weight, setWeight] = useState(product.weight_grams?.toString() ?? "");
    const [price, setPrice] = useState(product.price.replace(/[^0-9]/g, ""));
    const [stock, setStock] = useState(product.stock.toString());
    const [bargainEnabled, setBargainEnabled] = useState(product.bargain_enabled);
    const [floorPrice, setFloorPrice] = useState(product.floor_price?.replace(/[^0-9]/g, "") ?? "");
    const [tierFloorDefault, setTierFloorDefault] = useState(product.tiered_floor_price?.default ? String(Math.round(product.tiered_floor_price.default)) : "");
    const [tierFloorHighTrust, setTierFloorHighTrust] = useState(product.tiered_floor_price?.high_trust ? String(Math.round(product.tiered_floor_price.high_trust)) : "");
    const [tierFloorPlatinum, setTierFloorPlatinum] = useState(product.tiered_floor_price?.platinum_buyer ? String(Math.round(product.tiered_floor_price.platinum_buyer)) : "");
    const [images, setImages] = useState<string[]>(product.images ?? []);
    const [uploading, setUploading] = useState(false);

    const getErrorMessage = (err: unknown, fallback: string) => {
        if (err instanceof Error && err.message.trim()) return err.message;
        if (typeof err === "string" && err.trim()) return err;
        if (err && typeof err === "object") {
            const e = err as { message?: unknown; error?: unknown };
            if (typeof e.message === "string" && e.message.trim()) return e.message;
            if (typeof e.error === "string" && e.error.trim()) return e.error;
        }
        return fallback;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        setError("");
        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("folder", "products");
                const response = await fetch("/api/upload", { method: "POST", body: formData });
                if (!response.ok) {
                    if (response.status === 429) throw new Error("Terlalu banyak request. Tunggu sebentar lalu coba lagi.");
                    let errMessage = "Upload gagal";
                    try {
                        const errData = await response.json();
                        errMessage = errData.error || errMessage;
                    } catch { /* non-JSON error body */ }
                    throw new Error(errMessage);
                }
                const data = await response.json();
                return data.url as string;
            });
            const urls = await Promise.all(uploadPromises);
            setImages((prev) => [...prev, ...urls]);
        } catch (err) {
            setError(getErrorMessage(err, "Upload gagal"));
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

    const formatPrice = (value: string) => {
        const num = value.replace(/\D/g, "");
        return new Intl.NumberFormat("id-ID").format(parseInt(num) || 0);
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPrice(e.target.value.replace(/\D/g, ""));
    };

    const toggleConditionChecklist = (item: string) => {
        setConditionChecklist((prev) =>
            prev.includes(item)
                ? prev.filter((value) => value !== item)
                : [...prev, item]
        );
    };

    const handleSubmit = async () => {
        setError("");
        setSuccess("");
        if (!title.trim()) { setError("Nama produk wajib diisi."); return; }
        if (!price || parseInt(price) <= 0) { setError("Harga produk wajib diisi."); return; }
        if (bargainEnabled && floorPrice) {
            const numericFloor = parseInt(floorPrice, 10);
            const numericPrice = parseInt(price, 10);
            if (Number.isNaN(numericFloor) || numericFloor <= 0) { setError("Floor price harus lebih dari 0."); return; }
            if (numericFloor >= numericPrice) { setError("Floor price harus lebih rendah dari harga jual."); return; }
        }
        if (images.length === 0) { setError("Minimal 1 foto produk wajib diupload."); return; }
        setLoading(true);
        try {
            const result = await updateProduct({
                id: product.id,
                title: title.trim(),
                description: description.trim() || undefined,
                brand: brand || undefined,
                gender,
                price: parseFloat(price),
                condition,
                condition_rating: condition === "PRELOVED" ? conditionRating : undefined,
                condition_checklist: condition === "PRELOVED" ? conditionChecklist : [],
                weight_grams: weight ? parseInt(weight) : undefined,
                images,
                stock: parseInt(stock) || 1,
                category_id: categoryId || undefined,
                bargain_enabled: bargainEnabled,
                floor_price: bargainEnabled && floorPrice ? parseFloat(floorPrice) : undefined,
                tiered_floor_price: bargainEnabled
                    ? {
                        default: tierFloorDefault ? parseFloat(tierFloorDefault) : undefined,
                        high_trust: tierFloorHighTrust ? parseFloat(tierFloorHighTrust) : undefined,
                        platinum_buyer: tierFloorPlatinum ? parseFloat(tierFloorPlatinum) : undefined,
                    }
                    : undefined,
            });
            if (!result.success) {
                setError("Gagal menyimpan perubahan.");
                return;
            }
            setSuccess("Produk berhasil diperbarui!");
            setTimeout(() => { router.push("/seller/products"); router.refresh(); }, 1000);
        } catch (err) {
            setError(getErrorMessage(err, "Gagal menyimpan perubahan."));
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        setError("");
        setLoading(true);
        try {
            await publishProduct(product.id);
            setSuccess("Produk berhasil dipublikasikan!");
            setTimeout(() => { router.push("/seller/products"); router.refresh(); }, 1000);
        } catch (err) {
            setError(getErrorMessage(err, "Gagal mempublikasikan produk."));
        } finally {
            setLoading(false);
        }
    };

    const handleArchive = async () => {
        if (!confirm("Arsipkan produk ini? Produk tidak akan tampil di platform.")) return;
        setError("");
        setLoading(true);
        try {
            await archiveProduct(product.id);
            setSuccess("Produk diarsipkan.");
            setTimeout(() => { router.push("/seller/products"); router.refresh(); }, 1000);
        } catch (err) {
            setError(getErrorMessage(err, "Gagal mengarsipkan produk."));
        } finally {
            setLoading(false);
        }
    };

    const statusLabel: Record<string, string> = {
        DRAFT: "Draft",
        PUBLISHED: "Aktif",
        ARCHIVED: "Arsip",
        MODERATED: "Dimoderasi",
    };

    return (
        <div className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="flex mb-6">
                <ol className="inline-flex items-center space-x-1 md:space-x-3">
                    <li className="inline-flex items-center">
                        <Link href="/seller" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-brand-primary">
                            <Home className="w-4 h-4 mr-2" />Home
                        </Link>
                    </li>
                    <li>
                        <div className="flex items-center">
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                            <Link href="/seller/products" className="ml-1 text-sm font-medium text-slate-500 hover:text-brand-primary md:ml-2">Produk</Link>
                        </div>
                    </li>
                    <li aria-current="page">
                        <div className="flex items-center">
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                            <span className="ml-1 text-sm font-medium text-slate-900 dark:text-white md:ml-2">Edit Produk</span>
                        </div>
                    </li>
                </ol>
            </nav>

            <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight mb-2 text-slate-900 dark:text-white uppercase">Edit Produk</h1>
                    <p className="text-slate-500 dark:text-slate-400">Perbarui informasi produk Anda.</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    product.status === "PUBLISHED" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                    product.status === "MODERATED" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                    "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                    {statusLabel[product.status] ?? product.status}
                </span>
            </div>

            {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">{error}</div>}
            {success && <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl">{success}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">
                    {/* Foto Produk */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Foto Produk</h3>
                            <span className="text-xs font-medium px-2 py-1 rounded bg-brand-primary/10 text-brand-primary">Wajib</span>
                        </div>
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-black/20 cursor-pointer hover:border-brand-primary transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {uploading ? <Loader2 className="w-10 h-10 text-brand-primary animate-spin" /> : <Upload className="w-10 h-10 text-slate-400 mb-3" />}
                                <p className="text-sm text-slate-500 dark:text-slate-400">{uploading ? "Mengupload..." : "Klik untuk upload foto produk"}</p>
                                <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP (Maks 4MB, Maks 10 foto)</p>
                            </div>
                            <input type="file" className="hidden" accept="image/*" multiple disabled={uploading || images.length >= 10} onChange={handleFileChange} />
                        </label>
                        {images.length > 0 && (
                            <div className="flex gap-4 mt-6 overflow-x-auto pb-2">
                                {images.map((url, index) => (
                                    <div key={index} className="relative group shrink-0 size-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                        <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button type="button" onClick={() => removeImage(index)} className="bg-red-500 text-white p-1 rounded-full size-6 flex items-center justify-center hover:bg-red-600">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        {index === 0 && <div className="absolute bottom-1 left-1 z-10 bg-brand-primary text-white text-[10px] px-1.5 py-0.5 rounded font-bold">UTAMA</div>}
                                        <Image alt={`Product image ${index + 1}`} className="object-cover" src={url} fill sizes="96px" />
                                    </div>
                                ))}
                                {images.length < 10 && (
                                    <div className="relative shrink-0 size-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                        <div className="w-full h-full bg-slate-50 dark:bg-black/20 flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-slate-400" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Informasi Produk */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Informasi Produk</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Nama Produk <span className="text-red-500">*</span></label>
                                <input className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 placeholder-slate-400" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Kategori</label>
                                    <div className="relative">
                                        <select className="w-full appearance-none rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-10" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                                            <option value="">Pilih Kategori</option>
                                            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500"><ChevronDown className="w-4 h-4" /></div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Merek</label>
                                    <input className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 placeholder-slate-400" type="text" list="edit-brand-suggestions" value={brand} onChange={(e) => setBrand(e.target.value)} />
                                    <datalist id="edit-brand-suggestions">{brands.map((b) => <option key={b} value={b} />)}</datalist>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Target Gender</label>
                                    <div className="relative">
                                        <select className="w-full appearance-none rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-10" value={gender} onChange={(e) => setGender(e.target.value as "UNISEX" | "MEN" | "WOMEN")}>
                                            <option value="UNISEX">Unisex</option>
                                            <option value="MEN">Pria</option>
                                            <option value="WOMEN">Wanita</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500"><ChevronDown className="w-4 h-4" /></div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Stok</label>
                                    <input className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Deskripsi</label>
                                <textarea className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 placeholder-slate-400 resize-none" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>
                        </div>
                    </section>

                    {/* Harga */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Harga</h3>
                        <div className="space-y-5">
                            <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Harga Jual <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center px-4 pointer-events-none text-slate-500 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-black/30 rounded-l-lg">
                                    <span className="text-sm font-medium">Rp</span>
                                </div>
                                <input className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pl-16 text-lg font-bold" placeholder="0" type="text" value={price ? formatPrice(price) : ""} onChange={handlePriceChange} />
                            </div>

                            <label className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 p-3">
                                <input
                                    type="checkbox"
                                    checked={bargainEnabled}
                                    onChange={(e) => setBargainEnabled(e.target.checked)}
                                    className="mt-0.5"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-200">
                                    Aktifkan negosiasi otomatis (auto-counter) untuk tawaran di bawah floor price.
                                </span>
                            </label>

                            {bargainEnabled && (
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Floor Price (private)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center px-4 pointer-events-none text-slate-500 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-black/30 rounded-l-lg">
                                            <span className="text-sm font-medium">Rp</span>
                                        </div>
                                        <input
                                            className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pl-16"
                                            placeholder="Opsional"
                                            type="text"
                                            value={floorPrice ? formatPrice(floorPrice) : ""}
                                            onChange={(e) => setFloorPrice(e.target.value.replace(/\D/g, ""))}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Nilai ini tidak terlihat buyer dan dipakai untuk auto-counter.</p>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-slate-500">Default Tier</label>
                                            <input
                                                className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 px-3 py-2"
                                                placeholder="Opsional"
                                                type="text"
                                                value={tierFloorDefault ? formatPrice(tierFloorDefault) : ""}
                                                onChange={(e) => setTierFloorDefault(e.target.value.replace(/\D/g, ""))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-slate-500">High Trust Tier</label>
                                            <input
                                                className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 px-3 py-2"
                                                placeholder="Opsional"
                                                type="text"
                                                value={tierFloorHighTrust ? formatPrice(tierFloorHighTrust) : ""}
                                                onChange={(e) => setTierFloorHighTrust(e.target.value.replace(/\D/g, ""))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-slate-500">Platinum Buyer Tier</label>
                                            <input
                                                className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 px-3 py-2"
                                                placeholder="Opsional"
                                                type="text"
                                                value={tierFloorPlatinum ? formatPrice(tierFloorPlatinum) : ""}
                                                onChange={(e) => setTierFloorPlatinum(e.target.value.replace(/\D/g, ""))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Kondisi */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Kondisi Barang</h3>
                        <div className="mb-8">
                            <label className="block text-sm font-medium mb-3 text-slate-500 dark:text-slate-400">Status Barang</label>
                            <div className="flex gap-4">
                                {(["NEW", "PRELOVED"] as const).map((c) => (
                                    <label key={c} className="cursor-pointer">
                                        <input className="peer sr-only" name="condition" type="radio" value={c} checked={condition === c} onChange={() => setCondition(c)} />
                                        <div className="px-6 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-slate-500 peer-checked:border-brand-primary peer-checked:text-brand-primary peer-checked:bg-brand-primary/5 transition-all flex items-center gap-2">
                                            {c === "NEW" ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                            <span className="font-bold">{c === "NEW" ? "Baru (New)" : "Pre-loved"}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        {condition === "PRELOVED" && (
                            <div className="p-6 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-bold text-slate-900 dark:text-white">Detail Kondisi</label>
                                    <span className="text-2xl font-black text-brand-primary">{conditionRating}<span className="text-sm font-normal text-slate-500">/10</span></span>
                                </div>
                                <input className="w-full h-2 z-20 focus:outline-none accent-brand-primary" max="10" min="1" step="1" type="range" value={conditionRating} onChange={(e) => setConditionRating(parseInt(e.target.value))} />

                                <div className="mt-5 space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verified Condition Checklist</p>
                                    <div className="flex flex-wrap gap-2">
                                        {CONDITION_CHECKLIST_ITEMS.map((item) => {
                                            const active = conditionChecklist.includes(item);
                                            return (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => toggleConditionChecklist(item)}
                                                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${active
                                                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                                                        }`}
                                                >
                                                    {item}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Pengiriman */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Pengiriman</h3>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">Berat Produk</label>
                            <div className="relative max-w-xs">
                                <input className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-16" placeholder="0" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-surface-dark rounded-r-lg">
                                    <span className="text-sm font-medium">Gram</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-6">
                        {product.status === "MODERATED" && (
                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex gap-3 items-start">
                                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-orange-500 font-bold text-sm mb-1">Produk Dimoderasi</p>
                                    <p className="text-slate-500 text-xs">Produk ini sedang dalam tinjauan tim moderasi. Perbaiki konten sesuai kebijakan lalu simpan.</p>
                                </div>
                            </div>
                        )}

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-lg">
                            <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                <Info className="w-5 h-5 text-brand-primary" />Seller Tips
                            </h4>
                            <ul className="space-y-3">
                                {[
                                    "Foto berkualitas tinggi meningkatkan konversi 3x.",
                                    "Deskripsi jujur tentang defect mencegah retur.",
                                    "Harga kompetitif = listing terjual lebih cepat.",
                                ].map((tip) => (
                                    <li key={tip} className="flex gap-3 text-sm text-slate-400">
                                        <CheckCircle className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                                        <span>{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <div className="flex flex-col gap-3">
                                <button type="button" onClick={handleSubmit} disabled={loading} className="w-full py-3.5 px-4 bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-brand-primary/25 flex justify-center items-center gap-2">
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />Simpan Perubahan</>}
                                </button>
                                {product.status !== "PUBLISHED" && (
                                    <button type="button" onClick={handlePublish} disabled={loading} className="w-full py-3.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2">
                                        Publikasikan
                                    </button>
                                )}
                                {product.status !== "ARCHIVED" && (
                                    <button type="button" onClick={handleArchive} disabled={loading} className="w-full py-3.5 px-4 bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-black/20 text-slate-500 hover:text-red-500 rounded-xl font-medium text-sm transition-all disabled:opacity-50">
                                        Arsipkan
                                    </button>
                                )}
                                <Link href="/seller/products" className="w-full py-3 px-4 text-center border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-black/20 transition-colors">
                                    Batal
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
