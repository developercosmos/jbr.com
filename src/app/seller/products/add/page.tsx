"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Home, ChevronRight, X, Image as ImageIcon, ChevronDown, CheckCircle, Clock, Info, Save, AlertTriangle, Loader2 } from "lucide-react";
import { ProductImageUploader } from "@/components/Uploadthing";
import { createProduct } from "@/actions/products";

export default function AddProductPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Form state
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");
    const [brand, setBrand] = useState("");
    const [gender, setGender] = useState<"UNISEX" | "MEN" | "WOMEN">("UNISEX");
    const [description, setDescription] = useState("");
    const [condition, setCondition] = useState<"NEW" | "PRELOVED">("PRELOVED");
    const [conditionRating, setConditionRating] = useState(8);
    const [weight, setWeight] = useState("");
    const [price, setPrice] = useState("");
    const [images, setImages] = useState<string[]>([]);

    const handleImageUpload = (urls: string[]) => {
        setImages((prev) => [...prev, ...urls]);
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (asDraft = false) => {
        setError("");

        if (!title || !price || images.length === 0) {
            setError("Nama produk, harga, dan minimal 1 foto wajib diisi.");
            return;
        }

        setLoading(true);

        try {
            await createProduct({
                title,
                description,
                brand: brand || undefined,
                gender,
                price: parseFloat(price),
                condition,
                condition_rating: condition === "PRELOVED" ? conditionRating : undefined,
                weight_grams: weight ? parseInt(weight) : undefined,
                images,
                stock: 1,
            });

            router.push("/seller/products");
            router.refresh();
        } catch {
            setError("Gagal menyimpan produk. Silakan coba lagi.");
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
                    Listing produk olahraga baru atau bekas anda dengan mudah dan
                    transparan.
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                    {error}
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

                        {/* UploadThing Dropzone */}
                        <ProductImageUploader
                            onUploadComplete={handleImageUpload}
                            onUploadError={(err) => setError(err.message)}
                        />

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
                                    Nama Produk
                                </label>
                                <input
                                    className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 placeholder-slate-400"
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
                                            className="w-full appearance-none rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-10"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                        >
                                            <option disabled value="">
                                                Pilih Kategori
                                            </option>
                                            <option value="rackets">Raket</option>
                                            <option value="shoes">Sepatu</option>
                                            <option value="apparel">Pakaian</option>
                                            <option value="accessories">Aksesoris</option>
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
                                            className="w-full appearance-none rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-10"
                                            value={brand}
                                            onChange={(e) => setBrand(e.target.value)}
                                        >
                                            <option disabled value="">
                                                Pilih Merek
                                            </option>
                                            <option value="Yonex">Yonex</option>
                                            <option value="Li-Ning">Li-Ning</option>
                                            <option value="Victor">Victor</option>
                                            <option value="Mizuno">Mizuno</option>
                                            <option value="Apacs">Apacs</option>
                                            <option value="Kawasaki">Kawasaki</option>
                                            <option value="Flypower">Flypower</option>
                                            <option value="Lainnya">Lainnya</option>
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
                                            className="w-full appearance-none rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-10"
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
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                                    Deskripsi
                                </label>
                                <textarea
                                    className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 placeholder-slate-400 resize-none"
                                    placeholder="Jelaskan spesifikasi, fitur, dan alasan jual..."
                                    rows={4}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                ></textarea>
                            </div>
                        </div>
                    </section>

                    {/* 3. Condition Section */}
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
                    </section>

                    {/* 4. Shipping Section */}
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
                                        className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 pr-16"
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
                                            className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 text-center"
                                            placeholder="P"
                                            type="number"
                                        />
                                        <span className="absolute right-3 top-3 text-slate-500 text-xs">
                                            cm
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 text-center"
                                            placeholder="L"
                                            type="number"
                                        />
                                        <span className="absolute right-3 top-3 text-slate-500 text-xs">
                                            cm
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary py-3 px-4 text-center"
                                            placeholder="T"
                                            type="number"
                                        />
                                        <span className="absolute right-3 top-3 text-slate-500 text-xs">
                                            cm
                                        </span>
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
                            {/* Decorative circle */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl"></div>
                            <div className="relative z-10">
                                <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-brand-primary" />
                                    Seller Tips
                                </h4>
                                <ul className="space-y-3">
                                    <li className="flex gap-3 text-sm text-slate-400">
                                        <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />
                                        <span>
                                            Gunakan pencahayaan alami untuk foto produk yang lebih
                                            menarik.
                                        </span>
                                    </li>
                                    <li className="flex gap-3 text-sm text-slate-400">
                                        <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />
                                        <span>
                                            Jelaskan defect sekecil apapun untuk menghindari retur.
                                        </span>
                                    </li>
                                    <li className="flex gap-3 text-sm text-slate-400">
                                        <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />
                                        <span>Gunakan box kardus tebal untuk pengiriman raket.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/* Pickup Address Warning */}
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 items-start">
                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                                <p className="text-red-500 font-bold text-sm mb-1">
                                    Alamat Penjemputan Kosong
                                </p>
                                <p className="text-slate-500 text-xs">
                                    Anda belum mengatur alamat toko. Produk tidak dapat disimpan.
                                </p>
                                <Link
                                    href="#"
                                    className="text-red-400 text-xs font-semibold hover:underline mt-2 inline-block"
                                >
                                    Atur Alamat Sekarang →
                                </Link>
                            </div>
                        </div>
                        {/* Actions */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleSubmit(false)}
                                    disabled={loading || !title || !price || images.length === 0}
                                    className="w-full py-3.5 px-4 bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-brand-primary/25 flex justify-center items-center gap-2"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Simpan Produk
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit(true)}
                                    disabled={loading}
                                    className="w-full py-3.5 px-4 bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-black/20 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50"
                                >
                                    Simpan sebagai Draft
                                </button>
                            </div>
                            <p className="text-center text-xs text-slate-500 mt-4">
                                Dengan menyimpan, anda menyetujui{" "}
                                <Link href="#" className="text-brand-primary hover:underline">
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
