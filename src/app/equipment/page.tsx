import { getCategories } from "@/actions/categories";
import { getFilteredProducts, getProductCount } from "@/actions/products";
import Link from "next/link";
import { Wrench, Package, ChevronRight } from "lucide-react";

// Icons from react-icons - using verified available icons
import {
    GiFeather,        // Shuttlecock
    GiTennisCourt,    // Raket/Court
    GiRunningShoe,    // Sepatu
    GiBackpack,       // Tas
    GiRolledCloth,    // Grip/wrap
    GiWireCoil,       // Senar
} from "react-icons/gi";
import {
    IoShirtOutline,   // Pakaian
    IoExtensionPuzzleOutline, // Aksesoris
} from "react-icons/io5";
import { TbPackage } from "react-icons/tb";

// Icon component map for database icon names
const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
    Target: GiTennisCourt,          // Raket
    Footprints: GiRunningShoe,      // Sepatu
    Backpack: GiBackpack,           // Tas
    Shirt: IoShirtOutline,          // Pakaian
    Circle: GiFeather,              // Shuttlecock
    Zap: GiRolledCloth,             // Grip
    Gauge: GiWireCoil,              // Senar
    Sparkles: IoExtensionPuzzleOutline, // Aksesoris
};

// Get icon component by database icon name
function getIconComponent(iconName: string | null) {
    if (!iconName) return TbPackage;
    return iconComponents[iconName] || TbPackage;
}

// Equipment categories slugs - these are the main equipment categories
const EQUIPMENT_CATEGORY_SLUGS = [
    "rackets",
    "strings",
    "grips",
    "bags",
    "shoes",
    "shuttlecocks",
    "accessories",
    "apparel",
];

export default async function EquipmentPage() {
    // Get all categories for the sidebar
    const allCategories = await getCategories();

    // Filter equipment categories
    const equipmentCategories = allCategories.filter(c =>
        EQUIPMENT_CATEGORY_SLUGS.includes(c.slug)
    );

    // Get all published products for equipment display
    const [products, productCount] = await Promise.all([
        getFilteredProducts({ sortBy: "newest", limit: 48 }),
        getProductCount({}),
    ]);

    return (
        <main className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumbs */}
                    <div className="flex flex-wrap gap-2 items-center mb-4 text-sm">
                        <Link href="/" className="text-slate-500 hover:text-brand-primary font-medium">
                            Beranda
                        </Link>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-900 font-medium">Equipment</span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase mb-2">
                        Equipment
                    </h1>
                    <p className="text-slate-500">
                        Semua perlengkapan olahraga yang kamu butuhkan
                    </p>
                </div>
            </div>

            {/* Category Grid */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Kategori Equipment</h2>

                {equipmentCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-3 mb-8">
                        {equipmentCategories.map((category) => {
                            const Icon = getIconComponent(category.icon);
                            return (
                                <Link
                                    key={category.id}
                                    href={`/category/${category.slug}`}
                                    className="group flex items-center gap-2 bg-white rounded-full px-4 py-2.5 border border-slate-200 hover:border-brand-primary hover:shadow-md transition-all"
                                >
                                    <Icon className="w-5 h-5 text-slate-500 group-hover:text-brand-primary" />
                                    <span className="font-medium text-slate-900 group-hover:text-brand-primary text-sm whitespace-nowrap">
                                        {category.name}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 mb-8 text-center">
                        <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">Kategori equipment belum tersedia</p>
                        <p className="text-sm text-slate-400 mt-1">Admin dapat menambahkan kategori di dashboard</p>
                    </div>
                )}

                {/* All Products */}
                <h2 className="text-lg font-bold text-slate-900 mb-4">
                    Semua Produk ({productCount})
                </h2>

                {products.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                        {products.map((product) => (
                            <Link
                                key={product.id}
                                href={`/product/${product.slug}`}
                                className="group bg-white rounded-xl overflow-hidden border border-slate-100 hover:border-brand-primary hover:shadow-lg transition-all"
                            >
                                {/* Image */}
                                <div className="relative aspect-square bg-slate-100">
                                    {product.images && product.images[0] ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <Package className="w-12 h-12" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 left-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${product.condition === "NEW"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-orange-100 text-orange-700"
                                            }`}>
                                            {product.condition === "NEW" ? "Baru" : "Preloved"}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1 group-hover:text-brand-primary transition-colors">
                                        {product.title}
                                    </h3>
                                    <p className="text-base font-bold text-brand-primary">
                                        {new Intl.NumberFormat("id-ID", {
                                            style: "currency",
                                            currency: "IDR",
                                            minimumFractionDigits: 0,
                                        }).format(parseFloat(product.price))}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Belum ada produk</h3>
                        <p className="text-slate-500">Produk akan muncul setelah seller menambahkan</p>
                    </div>
                )}
            </div>
        </main>
    );
}
