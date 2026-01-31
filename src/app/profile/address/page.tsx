import { Plus, Search, CheckCircle, Truck, Package, Phone, MapPin, Trash2 } from "lucide-react";

export default function AddressBookPage() {
    return (
        <>
            {/* Page Heading */}
            <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">
                        Akun Saya / Alamat
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                        Daftar Alamat
                    </h1>
                </div>
                <button className="flex items-center gap-2 cursor-pointer overflow-hidden rounded-lg h-10 px-5 bg-brand-primary hover:bg-brand-primary-dark transition-colors text-white text-sm font-bold shadow-lg shadow-brand-primary/20">
                    <Plus className="w-5 h-5" />
                    <span className="truncate">Tambah Alamat Baru</span>
                </button>
            </div>

            {/* Search & Filter */}
            <div className="mb-6">
                <label className="flex flex-col w-full">
                    <div className="flex w-full items-center rounded-lg h-12 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 focus-within:border-brand-primary transition-colors">
                        <div className="text-slate-400 flex items-center justify-center pl-4 pr-2">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            className="flex w-full bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 placeholder:text-slate-400 px-2 text-sm font-normal h-full outline-none"
                            placeholder="Cari alamat berdasarkan nama penerima, label, atau jalan..."
                        />
                    </div>
                </label>
            </div>

            {/* Address List Grid */}
            <div className="flex flex-col gap-4">
                {/* Primary Address Card */}
                <div className="relative flex flex-col p-5 rounded-xl bg-white dark:bg-surface-dark border border-brand-primary/40 shadow-[0_0_0_1px_rgba(25,127,230,0.1)] transition-all hover:border-brand-primary/60">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                Rumah
                            </span>
                            <h3 className="text-slate-900 dark:text-white text-lg font-bold">
                                Budi Santoso
                            </h3>
                            <div title="Verified Address">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-brand-primary text-white">
                                <Truck className="w-3.5 h-3.5" />
                                Utama Pengiriman
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-brand-primary text-white">
                                <Package className="w-3.5 h-3.5" />
                                Utama Penjemputan
                            </span>
                        </div>
                    </div>
                    {/* Body */}
                    <div className="flex flex-col sm:flex-row gap-6 mb-6">
                        <div className="flex-1 text-sm text-slate-500 dark:text-slate-400 space-y-2">
                            <p className="text-slate-900 dark:text-white text-base font-medium">
                                Jl. Jendral Sudirman No. 45, RT.01/RW.02
                            </p>
                            <p>Tanah Abang, Jakarta Pusat</p>
                            <p>DKI Jakarta, 10220</p>
                            <div className="flex items-center gap-2 pt-1 text-slate-900 dark:text-white">
                                <Phone className="w-4 h-4 text-slate-400" />
                                <span>(+62) 812-3456-7890</span>
                            </div>
                        </div>
                        {/* Static Map Placeholder */}
                        <div className="w-full sm:w-32 h-20 rounded-lg overflow-hidden relative border border-slate-200 dark:border-slate-800">
                            <div
                                className="w-full h-full bg-cover bg-center opacity-60"
                                style={{
                                    backgroundImage:
                                        "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB_8QHMmvtH2aDLMheLJPJx4S76ovAEhVsSIOitAKTEvMhbyYJmKg95XGlSMByHksjlvdhaw7J8O29F0WBpGSb8zYt3I-ou6zvl63MPPC4AfmX0Tb07cNpRu6sjrzqJyEBTV2EVmjRTf_hwifjiOrOhOzVOg1mUYzScmG9Lk27IsISWwBl9LAa0gTuh94esIX6V88Rebrxboc1-WShyU65n-Hs38_wtxbir9VauskOPhivgRmqb_aztzqWTcAOe4eR1fVI53C3G-xY')",
                                }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <MapPin className="w-6 h-6 text-white drop-shadow-md" />
                            </div>
                        </div>
                    </div>
                    {/* Footer Actions */}
                    <div className="flex items-center gap-3 mt-auto">
                        <button className="flex items-center justify-center h-9 px-4 rounded-lg bg-transparent border border-slate-300 dark:border-slate-700 hover:border-brand-primary hover:text-brand-primary text-slate-900 dark:text-white text-sm font-semibold transition-colors">
                            Ubah Alamat
                        </button>
                        <button
                            className="flex items-center justify-center h-9 px-3 rounded-lg bg-transparent hover:bg-red-500/10 hover:text-red-500 text-slate-400 transition-colors ml-auto group"
                            disabled
                            title="Delete Address"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Secondary Address Card */}
                <div className="relative flex flex-col p-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                Kantor
                            </span>
                            <h3 className="text-slate-900 dark:text-white text-lg font-bold">
                                Kantor Budi (Receiving)
                            </h3>
                        </div>
                    </div>
                    {/* Body */}
                    <div className="flex flex-col sm:flex-row gap-6 mb-6">
                        <div className="flex-1 text-sm text-slate-500 dark:text-slate-400 space-y-2">
                            <p className="text-slate-900 dark:text-white text-base font-medium">
                                Gedung Olahraga Lt. 2, Jl. Asia Afrika No. 8
                            </p>
                            <p>Gelora, Jakarta Selatan</p>
                            <p>DKI Jakarta, 12190</p>
                            <div className="flex items-center gap-2 pt-1 text-slate-900 dark:text-white">
                                <Phone className="w-4 h-4 text-slate-400" />
                                <span>(+62) 811-0000-1111</span>
                            </div>
                        </div>
                        {/* Static Map Placeholder */}
                        <div className="w-full sm:w-32 h-20 rounded-lg overflow-hidden relative border border-slate-200 dark:border-slate-800">
                            <div
                                className="w-full h-full bg-cover bg-center opacity-60"
                                style={{
                                    backgroundImage:
                                        "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCqQX116eSGbNIslzMiD_ndA1KXDbYs5IcZpjQT5wpRc1YLDf06Ddm4ZlFOpB8t1hDZenjisHIh_ilDkRsp8YJTF6KX3T3RRuUTJaCzPZccAAO2sSs1YISQ3Mvu2ZqA-2yKqQbgmLgErelAXrQbcy-CYsAx7cPLrwu3ii6uEJPgogqTNFgAi7Dnss0F_dfALkKKDfa1vq0SI2eFKLmWoti7Y3X6DpbYcEBTfygFuUCL6HkllusnT-U4IRhL_cjixp_yhNZ_4SJK61g')",
                                }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <MapPin className="w-6 h-6 text-white drop-shadow-md" />
                            </div>
                        </div>
                    </div>
                    {/* Footer Actions */}
                    <div className="flex flex-wrap items-center gap-3 mt-auto">
                        <button className="flex items-center justify-center h-9 px-4 rounded-lg bg-transparent border border-slate-300 dark:border-slate-700 hover:border-brand-primary hover:text-brand-primary text-slate-900 dark:text-white text-sm font-semibold transition-colors">
                            Ubah Alamat
                        </button>
                        <button className="flex items-center justify-center h-9 px-4 rounded-lg bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium transition-colors">
                            Atur sebagai Utama
                        </button>
                        <button
                            className="flex items-center justify-center h-9 px-3 rounded-lg bg-transparent hover:bg-red-500/10 hover:text-red-500 text-slate-400 transition-colors ml-auto group"
                            title="Delete Address"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
