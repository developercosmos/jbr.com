"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Home, ChevronRight, X, Image as ImageIcon, ChevronDown, CheckCircle, Clock, Info, Save, AlertTriangle, Loader2 } from "lucide-react";
import { Upload } from "lucide-react";
import { createProduct, publishProduct } from "@/actions/products";

interface Category {
    id: string;
    name: string;
    slug: string;
}

interface AddProductFormProps {
    categories: Category[];
    brands: string[];
    hasPickupAddress: boolean;
}

export function AddProductForm({ categories, brands, hasPickupAddress }: AddProductFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form state
    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [brand, setBrand] = useState("");
    const [gender, setGender] = useState<"UNISEX" | "MEN" | "WOMEN">("UNISEX");
    const [description, setDescription] = useState("");
    const [condition, setCondition] = useState<"NEW" | "PRELOVED">("PRELOVED");
    const [conditionRating, setConditionRating] = useState(8);
    const [weight, setWeight] = useState("");
    const [price, setPrice] = useState("");
    const [stock, setStock] = useState("1");
    const [images, setImages] = useState<string[]>([]);

    // Dimensions
    const [dimensionL, setDimensionL] = useState("");
    const [dimensionW, setDimensionW] = useState("");
    const [dimensionH, setDimensionH] = useState("");

    const [uploading, setUploading] = useState(false);

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

                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Upload gagal");
                }

                const data = await response.json();
                return data.url;
            });

            const urls = await Promise.all(uploadPromises);
            setImages((prev) => [...prev, ...urls]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload gagal");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const formatPrice = (value: string) => {
        // Remove non-digits
        const num = value.replace(/\D/g, "");
        // Format with thousand separators
        return new Intl.NumberFormat("id-ID").format(parseInt(num) || 0);
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, "");
        setPrice(rawValue);
    };

    const handleSubmit = async (asDraft = false) => {
        setError("");
        setSuccess("");

        // Validations
        if (!title.trim()) {
            setError("Nama produk wajib diisi.");
            return;
        }

        if (!price || parseInt(price) <= 0) {
            setError("Harga produk wajib diisi dan harus lebih dari 0.");
            return;
        }

        if (images.length === 0) {
            setError("Minimal 1 foto produk wajib diupload.");
            return;
        }

        if (!hasPickupAddress && !asDraft) {
            setError("Anda harus mengatur alamat penjemputan sebelum mempublikasikan produk.");
            return;
        }

        setLoading(true);

        try {
            // Create product as draft first
            const result = await createProduct({
                title: title.trim(),
                description: description.trim() || undefined,
                brand: brand || undefined,
                gender,
                price: parseFloat(price),
                condition,
                condition_rating: condition === "PRELOVED" ? conditionRating : undefined,
                weight_grams: weight ? parseInt(weight) : undefined,
                images,
                stock: parseInt(stock) || 1,
                category_id: categoryId || undefined,
            });

            // If not draft, publish immediately
            if (!asDraft && result.product?.id) {
                await publishProduct(result.product.id);
                setSuccess("Produk berhasil dipublikasikan!");
            } else {
                setSuccess("Draft berhasil disimpan!");
            }

            // Redirect after short delay
            setTimeout(() => {
                router.push("/seller/products");
                router.refresh();
            }, 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menyimpan produk. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="flex mb-6">
                <ol className="inline-flex items-center space-x-1 md:space-x-3">
                    <li className="inline-flex items-center">
                        <Link
                            href="/seller"
                            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-brand-primary"
                        >
                            <Home className="w-4 h-4 mr-2" />
                            Home
                        </Link>
                    </li>
                    <li>
                        <div className="flex items-center">
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                            <Link
                                href="/seller/products"
                                className="ml-1 text-sm font-medium text-slate-500 hover:text-brand-primary md:ml-2"
                            >
                                Produk
                            </Link>
                        </div>
                    </li>
                    <li aria-current="page">
                        <div className="flex items-center">
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                            <span className="ml-1 text-sm font-medium text-slate-900 dark:text-white md:ml-2">
                                Tambah Produk
                            </span>
                        </div>
                    </li>
                </ol>
            </nav>

            {/* Page Header */}
            <div className="mb-10">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight mb-2 text-slate-900 dark:text-white uppercase">
                    Tambah Produk Baru
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg">
                    Listing produk olahraga baru atau bekas anda dengan mudah dan transparan.
                </p>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl">
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form Column */}
                <div className="lg:col-span-2 flex flex-col gap-8">
                    {/* 1. Media Upload Section */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Foto Produk
                            </h3>
                            <span className="text-xs font-medium px-2 py-1 rounded bg-brand-primary/10 text-brand-primary">
                                Wajib
                            </span>
                        </div>

                        {/* Image Upload */}
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-black/20 cursor-pointer hover:border-brand-primary transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {uploading ? (
                                    <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
                                ) : (
                                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                                )}
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {uploading ? "Mengupload..." : "Klik untuk upload foto produk"}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    PNG, JPG, WEBP (Maks 4MB, Maks 10 foto)
                                </p>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                multiple
                                disabled={uploading || images.length >= 10}
                                onChange={handleFileChange}
                            />
                        </label>

                        {/* Thumbnails Preview */}
                        {images.length > 0 && (
                            <div className="flex gap-4 mt-6 overflow-x-auto pb-2">
                                {images.map((url, index) => (
                                    <div key={index} className="relative group shrink-0 size-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                        <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="bg-red-500 text-white p-1 rounded-full size-6 flex items-center justify-center hover:bg-red-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        {index === 0 && (
                                            <div className="absolute bottom-1 left-1 z-10 bg-brand-primary text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                                                UTAMA
                                            </div>
                                        )}
                                        <Image
                                            alt={`Product image ${index + 1}`}
                                            className="object-cover"
                                            src={url}
                                            fill
                                        />
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

                    {/* 2. Product Information */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">
                            Informasi Produk
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                    Nama Produk <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 placeholder-slate-400"
                                    placeholder="Contoh: Yonex Astrox 99 Pro (4U G5)"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                        Kategori
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full appearance-none rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-10"
                                            value={categoryId}
                                            onChange={(e) => setCategoryId(e.target.value)}
                                        >
                                            <option value="">Pilih Kategori</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                        Merek
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full appearance-none rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-10"
                                            value={brand}
                                            onChange={(e) => setBrand(e.target.value)}
                                        >
                                            <option value="">Pilih Merek</option>
                                            {brands.length > 0 ? (
                                                brands.map((b) => (
                                                    <option key={b} value={b}>{b}</option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="Yonex">Yonex</option>
                                                    <option value="Li-Ning">Li-Ning</option>
                                                    <option value="Victor">Victor</option>
                                                    <option value="Mizuno">Mizuno</option>
                                                    <option value="Apacs">Apacs</option>
                                                    <option value="Kawasaki">Kawasaki</option>
                                                    <option value="Flypower">Flypower</option>
                                                    <option value="Lainnya">Lainnya</option>
                                                </>
                                            )}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                        Target Gender
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full appearance-none rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-10"
                                            value={gender}
                                            onChange={(e) => setGender(e.target.value as "UNISEX" | "MEN" | "WOMEN")}
                                        >
                                            <option value="UNISEX">Unisex</option>
                                            <option value="MEN">Pria</option>
                                            <option value="WOMEN">Wanita</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                        Stok
                                    </label>
                                    <input
                                        className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4"
                                        placeholder="1"
                                        type="number"
                                        min="1"
                                        value={stock}
                                        onChange={(e) => setStock(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                    Deskripsi
                                </label>
                                <textarea
                                    className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 placeholder-slate-400 resize-none"
                                    placeholder="Jelaskan spesifikasi, fitur, dan alasan jual..."
                                    rows={4}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                ></textarea>
                            </div>
                        </div>
                    </section>

                    {/* 3. Price Section */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">
                            Harga
                        </h3>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                Harga Jual <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center px-4 pointer-events-none text-slate-500 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-black/30 rounded-l-lg">
                                    <span className="text-sm font-medium">Rp</span>
                                </div>
                                <input
                                    className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pl-16 text-lg font-bold"
                                    placeholder="0"
                                    type="text"
                                    value={price ? formatPrice(price) : ""}
                                    onChange={handlePriceChange}
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                Tips: Riset harga pasar untuk menentukan harga kompetitif
                            </p>
                        </div>
                    </section>

                    {/* 4. Condition Section */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">
                            Kondisi Barang
                        </h3>
                        <div className="mb-8">
                            <label className="block text-sm font-medium mb-3 text-slate-500 dark:text-slate-400">
                                Status Barang
                            </label>
                            <div className="flex gap-4">
                                <label className="cursor-pointer">
                                    <input
                                        className="peer sr-only"
                                        name="condition"
                                        type="radio"
                                        value="NEW"
                                        checked={condition === "NEW"}
                                        onChange={() => setCondition("NEW")}
                                    />
                                    <div className="px-6 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-slate-500 peer-checked:border-brand-primary peer-checked:text-brand-primary peer-checked:bg-brand-primary/5 transition-all flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="font-bold">Baru (New)</span>
                                    </div>
                                </label>
                                <label className="cursor-pointer">
                                    <input
                                        className="peer sr-only"
                                        name="condition"
                                        type="radio"
                                        value="PRELOVED"
                                        checked={condition === "PRELOVED"}
                                        onChange={() => setCondition("PRELOVED")}
                                    />
                                    <div className="px-6 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-slate-500 peer-checked:border-brand-primary peer-checked:text-brand-primary peer-checked:bg-brand-primary/5 transition-all flex items-center gap-2">
                                        <Clock className="w-5 h-5" />
                                        <span className="font-bold">Pre-loved</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                        {/* Dynamic Slider for 'Bekas' */}
                        {condition === "PRELOVED" && (
                            <div className="p-6 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-bold text-slate-900 dark:text-white">
                                        Detail Kondisi
                                    </label>
                                    <span className="text-2xl font-black text-brand-primary">
                                        {conditionRating}<span className="text-sm font-normal text-slate-500">/10</span>
                                    </span>
                                </div>
                                <div className="relative w-full h-12 flex items-center">
                                    <input
                                        className="w-full h-2 z-20 focus:outline-none accent-brand-primary"
                                        max="10"
                                        min="1"
                                        step="1"
                                        type="range"
                                        value={conditionRating}
                                        onChange={(e) => setConditionRating(parseInt(e.target.value))}
                                    />
                                    <div className="absolute w-full flex justify-between px-1 top-8">
                                        <span className="text-xs text-slate-500">Rusak Parah</span>
                                        <span className="text-xs text-slate-500">Layak Pakai</span>
                                        <span className="text-xs text-slate-500">Like New</span>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-3 p-3 bg-brand-primary/10 rounded-lg items-start">
                                    <Info className="w-4 h-4 text-brand-primary mt-0.5" />
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        <strong className="text-brand-primary block mb-1">
                                            Panduan Transparansi
                                        </strong>
                                        Untuk kondisi 8/10, barang mungkin memiliki sedikit lecet
                                        kosmetik tetapi fungsi utama masih sempurna. Pastikan foto
                                        menunjukkan cacat tersebut.
                                    </p>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* 5. Shipping Section */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">
                            Pengiriman
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                    Berat Produk
                                </label>
                                <div className="relative">
                                    <input
                                        className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-16"
                                        placeholder="0"
                                        type="number"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-surface-dark rounded-r-lg">
                                        <span className="text-sm font-medium">Gram</span>
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                    Dimensi Paket (P x L x T)
                                </label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="relative">
                                        <input
                                            className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 text-center"
                                            placeholder="P"
                                            type="number"
                                            value={dimensionL}
                                            onChange={(e) => setDimensionL(e.target.value)}
                                        />
                                        <span className="absolute right-3 top-3 text-slate-500 text-xs">cm</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 text-center"
                                            placeholder="L"
                                            type="number"
                                            value={dimensionW}
                                            onChange={(e) => setDimensionW(e.target.value)}
                                        />
                                        <span className="absolute right-3 top-3 text-slate-500 text-xs">cm</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 text-center"
                                            placeholder="T"
                                            type="number"
                                            value={dimensionH}
                                            onChange={(e) => setDimensionH(e.target.value)}
                                        />
                                        <span className="absolute right-3 top-3 text-slate-500 text-xs">cm</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sidebar / Helper Column */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    {/* Preview Card (Sticky) */}
                    <div className="sticky top-24 space-y-6">
                        {/* Tips Card */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-lg relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl"></div>
                            <div className="relative z-10">
                                <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-brand-primary" />
                                    Seller Tips
                                </h4>
                                <ul className="space-y-3">
                                    <li className="flex gap-3 text-sm text-slate-400">
                                        <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />
                                        <span>Gunakan pencahayaan alami untuk foto produk yang lebih menarik.</span>
                                    </li>
                                    <li className="flex gap-3 text-sm text-slate-400">
                                        <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />
                                        <span>Jelaskan defect sekecil apapun untuk menghindari retur.</span>
                                    </li>
                                    <li className="flex gap-3 text-sm text-slate-400">
                                        <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />
                                        <span>Gunakan box kardus tebal untuk pengiriman raket.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Pickup Address Warning */}
                        {!hasPickupAddress && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 items-start">
                                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                                <div>
                                    <p className="text-red-500 font-bold text-sm mb-1">
                                        Alamat Penjemputan Kosong
                                    </p>
                                    <p className="text-slate-500 text-xs">
                                        Anda belum mengatur alamat toko. Produk tidak dapat dipublikasikan.
                                    </p>
                                    <Link
                                        href="/seller/settings"
                                        className="text-red-400 text-xs font-semibold hover:underline mt-2 inline-block"
                                    >
                                        Atur Alamat Sekarang →
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleSubmit(false)}
                                    disabled={loading || !title || !price || images.length === 0 || !hasPickupAddress}
                                    className="w-full py-3.5 px-4 bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-brand-primary/25 flex justify-center items-center gap-2"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Simpan & Publikasikan
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit(true)}
                                    disabled={loading || !title || !price || images.length === 0}
                                    className="w-full py-3.5 px-4 bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-black/20 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50"
                                >
                                    Simpan sebagai Draft
                                </button>
                            </div>
                            <p className="text-center text-xs text-slate-500 mt-4">
                                Dengan menyimpan, anda menyetujui{" "}
                                <Link href="/terms" className="text-brand-primary hover:underline">
                                    Syarat & Ketentuan
                                </Link>{" "}
                                penjual.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
